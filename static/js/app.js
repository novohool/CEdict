class DictionaryApp {
    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.initState();
        this.initElements();
        this.bindEvents();
    }

    initState() {
        this.searchTimer = null;
        this.searchDelay = 5000; // 设置500ms的延迟
        this.history = JSON.parse(localStorage.getItem('cedict_history') || '[]');
        this.favorites = JSON.parse(localStorage.getItem('cedict_favorites') || '[]');
    }

    initElements() {
        this.elements = {
            search: document.getElementById('search'),
            result: document.getElementById('result'),
            loader: document.getElementById('loader'),
            clearSearch: document.getElementById('clearSearch'),
            historyList: document.getElementById('historyList'),
            favoritesList: document.getElementById('favoritesList'),
            newsList: document.getElementById('newsSection'),
            clearHistory: document.getElementById('clearHistory'),
            clearFavorites: document.getElementById('clearFavorites'),
            navItems: document.querySelectorAll('.nav-item'),
            sections: document.querySelectorAll('.content-section'),
            sidebar: document.querySelector('.sidebar'),
            searchBtn: document.getElementById('searchBtn')
        };

        // 验证必要的元素是否存在
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`找不到元素: ${key}`);
            }
        });
    }

    bindEvents() {
        if (this.elements.search) {
            this.elements.search.addEventListener('input', (e) => {
                clearTimeout(this.searchTimer);
                const value = e.target.value.trim();
                
                // 清除搜索按钮显示/隐藏
                if (this.elements.clearSearch) {
                    this.elements.clearSearch.style.display = value ? 'block' : 'none';
                }

                // 如果输入少于2个字符，不触发搜索
                if (value.length < 2) {
                    this.clearResults();
                    return;
                }

                // 延迟搜索
                this.searchTimer = setTimeout(() => {
                    this.handleSearch(value);
                }, this.searchDelay);
            });

            // 添加回车键搜索
            this.elements.search.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = e.target.value.trim();
                    if (value) {
                        this.handleSearch(value);
                    }
                }
            });
        }

        if (this.elements.clearSearch) {
            this.elements.clearSearch.addEventListener('click', () => this.clearSearch());
        }

        if (this.elements.navItems) {
            this.elements.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    const section = item.dataset.section;
                    if (section) {
                        this.showSection(section);
                    }
                });
            });
        }

        if (this.elements.clearHistory) {
            this.elements.clearHistory.addEventListener('click', () => this.clearHistory());
        }

        if (this.elements.clearFavorites) {
            this.elements.clearFavorites.addEventListener('click', () => this.clearFavorites());
        }

        if (this.elements.searchBtn) {
            this.elements.searchBtn.addEventListener('click', () => {
                const searchText = this.elements.search.value;
                if (searchText.trim()) {
                    this.handleSearch(searchText);
                }
            });
        }
    }

    async handleSearch(text) {
        if (!text.trim()) {
            this.clearResults();
            return;
        }

        const searchBtn = document.getElementById('searchBtn');
        searchBtn.classList.add('loading');

        try {
            const response = await fetch(`/api/word/${encodeURIComponent(text.trim())}`);
            if (!response.ok) throw new Error('查询失败');
            const data = await response.json();
            this.renderResults(data);
        } catch (error) {
            this.showError(error.message);
        } finally {
            searchBtn.classList.remove('loading');
        }
    }

    // UI 操作方法
    showLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'block';
        }
    }

    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
    }

    clearSearch() {
        if (this.elements.search) {
            this.elements.search.value = '';
        }
        this.clearResults();
    }

    clearResults() {
        if (this.elements.result) {
            this.elements.result.innerHTML = '';
        }
        if (this.elements.newsList) {
            this.elements.newsList.innerHTML = '';
        }
    }

    showSection(sectionId) {
        this.elements.navItems?.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        this.elements.sections?.forEach(section => {
            section.classList.toggle('active', section.id === `${sectionId}-section`);
        });
    }

    showError(message) {
        // 创建错误提示元素
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        if (this.elements.result) {
            this.elements.result.insertBefore(errorDiv, this.elements.result.firstChild);
            setTimeout(() => errorDiv.remove(), 3000);
        }
    }

    renderResults(data) {
        if (!this.elements.result) return;

        if (data.type === "not_found") {
            this.elements.result.innerHTML = '<div class="not-found">未找到相关单词</div>';
            return;
        }

        if (data.type === "exact") {
            // 渲染精确匹配结果
            const examples = data.examples?.map(example => 
                `<li class="example-item">${example}</li>`
            ).join('') || '';

            this.elements.result.innerHTML = `
                <div class="result-card">
                    <div class="result-header">
                        <h3>${data.word}</h3>
                        <button class="favorite-btn" data-word="${data.word}">
                            <i class="fas fa-star"></i>
                        </button>
                    </div>
                    <div class="translation">${data.translation.replace(/\n/g, '<br>')}</div>
                    ${examples ? `
                        <div class="examples-section">
                            <h4>例句：</h4>
                            <ul class="examples-list">${examples}</ul>
                        </div>
                    ` : ''}
                </div>
            `;

            // 获取相关新闻
            this.fetchRelatedNews(data.word);
        } else if (data.type === "similar") {
            // 渲染相似词结果
            const similarWords = data.similar_words?.map(item => `
                <div class="similar-word-item" data-word="${item.word}">
                    <span class="word">${item.word}</span>
                    <span class="translation">${item.translation}</span>
                </div>
            `).join('') || '';

            this.elements.result.innerHTML = `
                <div class="result-card">
                    <h3>相似单词：</h3>
                    <div class="similar-words-list">
                        ${similarWords}
                    </div>
                </div>
            `;

            // 为相似词添加点击事件
            document.querySelectorAll('.similar-word-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (this.elements.search) {
                        this.elements.search.value = item.dataset.word;
                        this.handleSearch(item.dataset.word);
                    }
                });
            });
        }
    }

    async fetchRelatedNews(word) {
        if (!this.elements.newsList) return;

        try {
            const response = await fetch(`/api/news?query=${encodeURIComponent(word)}`);
            if (!response.ok) throw new Error('获取新闻失败');
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const newsHtml = data.articles.map(article => `
                <div class="news-card ${article.sentiment}">
                    <div class="news-header">
                        ${article.image ? `<img src="${article.image}" alt="${article.title}" class="news-image">` : ''}
                        <h3 class="news-title">${article.title}</h3>
                    </div>
                    <div class="news-content">
                        <p class="news-description">${article.description || ''}</p>
                        <div class="news-meta">
                            ${article.author ? `<span class="news-author">作者: ${article.author}</span>` : ''}
                            <span class="news-date">${new Date(article.published_at).toLocaleString()}</span>
                            <span class="news-sentiment">情感: ${this.getSentimentText(article.sentiment)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            this.elements.newsList.innerHTML = newsHtml || '<div class="no-news">暂无相关新闻</div>';
        } catch (error) {
            console.error('获取新闻失败:', error);
            this.elements.newsList.innerHTML = '<div class="news-error">获取新闻失败</div>';
        }
    }

    getSentimentText(sentiment) {
        const sentimentMap = {
            'positive': '积极',
            'negative': '消极',
            'neutral': '中性'
        };
        return sentimentMap[sentiment] || '未知';
    }
}

// 初始化应用
window.addEventListener('load', () => {
    window.app = new DictionaryApp();
});
