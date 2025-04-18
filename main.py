from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import sqlite3
import requests
import zipfile
import os
from typing import Dict, List, Optional
from pydantic import BaseModel
import logging
import json

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

DB_URL = "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
DB_NAME = "stardict.db"

# API 配置
NEWS_API_KEY = ""
NEWS_API_URL = "https://api.apitube.io/v1/news/everything"

def ensure_database():
    """确保数据库文件存在，如果不存在则下载"""
    if os.path.exists(DB_NAME):
        logger.info(f"数据库文件已存在: {DB_NAME}")
        return
    
    logger.info("开始下载词典数据库...")
    try:
        # 下载zip文件
        response = requests.get(DB_URL, stream=True)
        zip_path = "temp.zip"
        with open(zip_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # 解压zip文件
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(".")
        
        # 清理临时文件
        os.remove(zip_path)
        logger.info("数据库下载和解压完成")
        
    except Exception as e:
        logger.error(f"下载数据库失败: {e}")
        raise Exception("无法下载词典数据库")

class SearchResult(BaseModel):
    type: str
    word: Optional[str] = None
    translation: Optional[str] = None
    similar_words: Optional[List[Dict[str, str]]] = None
    examples: Optional[List[str]] = None
    news: Optional[Dict] = None  # 添加news字段

app = FastAPI(title="智能词典")
app.mount("/static", StaticFiles(directory="static"), name="static")

class DBConfig:
    def __init__(self):
        self.table_name = None
        self.word_column = None
        self.translation_column = None

class DictDB:
    def __init__(self):
        logger.info("正在初始化词典数据库...")
        ensure_database()  # 确保数据库文件存在
        
        logger.info("正在连接数据库...")
        self.conn = sqlite3.connect(DB_NAME, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        
        logger.info("正在检测数据库结构...")
        self.config = self._detect_schema()
        
        logger.info(
            f"数据库初始化完成:\n"
            f"- 数据表: {self.config.table_name}\n"
            f"- 单词列: {self.config.word_column}\n"
            f"- 翻译列: {self.config.translation_column}"
        )
    
    def _detect_schema(self) -> DBConfig:
        """检测数据库结构"""
        config = DBConfig()
        cursor = self.conn.cursor()
        
        # 获取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        if not tables:
            raise Exception("数据库中没有表")
        
        # 找到最大的表（假设是主表）
        max_rows = 0
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            if count > max_rows:
                max_rows = count
                config.table_name = table_name
        
        # 获取列信息
        cursor.execute(f"PRAGMA table_info({config.table_name})")
        columns = cursor.fetchall()
        
        # 查找单词和翻译列
        for col in columns:
            col_name = col[1].lower()
            if any(x in col_name for x in ['word', 'english', 'vocab']):
                config.word_column = col[1]
            elif any(x in col_name for x in ['trans', 'chinese', 'mean']):
                config.translation_column = col[1]
        
        if not all([config.table_name, config.word_column, config.translation_column]):
            raise Exception("无法识别必要的数据库字段")
        
        return config
    
    def _is_chinese(self, text: str) -> bool:
        """检测是否包含中文字符"""
        return any('\u4e00' <= char <= '\u9fff' for char in text)
    
    def search(self, text: str) -> SearchResult:
        cursor = self.conn.cursor()
        text = text.strip().lower()
        if not text:
            return SearchResult(type="not_found")

        is_cn = self._is_chinese(text)
        search_col = self.config.translation_column if is_cn else self.config.word_column

        # 统一查询逻辑，获取前5个最相关的结果
        cursor.execute(
            f"""SELECT {self.config.word_column}, {self.config.translation_column} 
            FROM {self.config.table_name} 
            WHERE lower({search_col}) LIKE ? 
            ORDER BY CASE 
                WHEN lower({search_col}) = ? THEN 1        -- 完全匹配
                WHEN lower({search_col}) = ? || '%' THEN 2 -- 前缀匹配
                WHEN lower({search_col}) LIKE ? THEN 3     -- 包含匹配
                ELSE 4
            END,
            length({search_col}) -- 优先选择较短的词
            LIMIT 5""",
            (f"%{text}%", text, text, f"%{text}%")
        )
        rows = cursor.fetchall()

        if not rows:
            return SearchResult(type="not_found")

        # 如果第一个结果是完全匹配或前缀匹配，返回精确结果
        first_row = rows[0]
        first_word = first_row[self.config.word_column].lower()
        first_trans = first_row[self.config.translation_column].lower()
        search_value = first_word if not is_cn else first_trans

        if text == search_value or search_value.startswith(text):
            try:
                examples = self.get_examples(first_row[self.config.word_column])
            except Exception as e:
                logger.warning(f"获取例句失败: {e}")
                examples = []

            return SearchResult(
                type="exact",
                word=first_row[self.config.word_column],
                translation=first_row[self.config.translation_column],
                examples=examples
            )

        # 否则返回相似结果
        return SearchResult(
            type="similar",
            similar_words=[{
                'word': row[self.config.word_column],
                'translation': row[self.config.translation_column]
            } for row in rows]  # 返回所有找到的结果（最多5个）
        )

    def get_examples(self, word: str) -> List[str]:
        """获取单词的例句"""
        try:
            # 调用Free Dictionary API获取例句
            url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
            response = requests.get(url)
            
            if response.status_code != 200:
                logger.warning(f"获取例句失败: {response.status_code}")
                return self.get_default_examples(word)
            
            data = response.json()
            examples = []
            
            # 解析API返回的数据，提取例句
            if isinstance(data, list) and len(data) > 0:
                for entry in data:
                    if 'meanings' in entry:
                        for meaning in entry['meanings']:
                            if 'definitions' in meaning:
                                for definition in meaning['definitions']:
                                    if 'example' in definition and definition['example']:
                                        examples.append(definition['example'])
            
            # 如果没有找到例句，返回默认例句
            if not examples:
                return self.get_default_examples(word)
            
            # 最多返回5个例句
            return examples[:5]
        except Exception as e:
            logger.error(f"获取例句出错: {e}")
            return self.get_default_examples(word)
    
    def get_default_examples(self, word: str) -> List[str]:
        """获取默认例句"""
        default_examples = {
            "hello": [
                "Hello, how are you today?",
                "She said hello to everyone in the room.",
                "I heard a faint hello from behind the door."
            ],
            "world": [
                "The world is a beautiful place.",
                "He traveled around the world in 80 days.",
                "This discovery will change the world."
            ],
            "computer": [
                "I need to buy a new computer.",
                "She works as a computer programmer.",
                "The computer crashed during the presentation."
            ],
            "book": [
                "I'm reading a good book right now.",
                "She wrote a book about her experiences.",
                "Please book a table for dinner tonight."
            ],
            "time": [
                "What time is it?",
                "We don't have much time left.",
                "Time flies when you're having fun."
            ]
        }
        
        # 如果有预设例句，返回预设例句
        if word.lower() in default_examples:
            return default_examples[word.lower()]
        
        # 否则返回通用例句
        return [
            f"This is an example sentence using the word '{word}'.",
            f"Let me show you how to use '{word}' in a sentence.",
            f"The word '{word}' can be used in various contexts."
        ]

db = DictDB()

@app.get("/api/word/{word}")
async def get_word(word: str):
    """查询单词接口"""
    try:
        # 主要查询结果
        result = db.search(word.strip())
        
        # 如果找到了单词，异步获取新闻
        if result.type == "exact":
            try:
                # 正确等待异步新闻结果
                news_result = await get_news(word.strip())
                # 可以选择是否将新闻结果添加到返回数据中
                result.news = news_result
            except Exception as e:
                logger.warning(f"获取新闻失败: {e}")
                result.news = {"error": str(e)}
        
        return result
    except Exception as e:
        logger.error(f"查询出错: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news")
async def get_news(query: str, count: int = 3):
    """获取与查询词相关的新闻"""
    try:
        logger.info(f"获取新闻: {query}, 数量: {count}")
        
        from aiohttp import ClientSession
        async with ClientSession() as session:
            # 构建URL，直接包含API key
            url = f"{NEWS_API_URL}?title={query}&api_key={NEWS_API_KEY}&per_page=5"
            
            headers = {
                "Content-Type": "application/json"
            }
            
            # 使用POST方法
            async with session.post(url, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"新闻API请求失败: {response.status}, {error_text}")
                    return {"error": "获取新闻失败", "status": response.status}
                
                news_data = await response.json()
                articles = []
                
                # 只取前5条新闻
                for article in news_data.get('results', [])[:5]:
                    articles.append({
                        'id': article.get('id'),
                        'title': article.get('title', '').split('...[')[0],
                        'description': article.get('description', '').split('...[')[0],
                        'published_at': article.get('published_at'),
                        'author': article.get('author', {}).get('name'),
                        'image': article.get('image'),
                        'sentiment': article.get('sentiment', {}).get('overall', {}).get('polarity', 'neutral')
                    })

                return {
                    "status": news_data.get("status"),
                    "articles": articles
                }
                
    except Exception as e:
        logger.error(f"获取新闻出错: {e}")
        return {"error": str(e)}

@app.get("/")
async def redirect_to_index():
    return RedirectResponse(url="/static/index.html")

# 添加应用启动事件处理
@app.on_event("startup")
async def startup_event():
    logger.info("=== 智能词典服务启动 ===")
    logger.info(f"数据库文件: {os.path.abspath(DB_NAME)}")
    logger.info("API endpoints:")
    logger.info("- GET /api/word/{word}: 查询单词")
    logger.info("- GET /api/news?query={word}: 获取相关新闻")
    logger.info("- GET /static/index.html: Web界面")
