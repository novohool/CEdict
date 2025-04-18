class DictionaryAPI {
    static async searchWord(word) {
        try {
            const response = await fetch(`/api/word/${encodeURIComponent(word.trim())}`);
            if (!response.ok) throw new Error('网络请求失败');
            return await response.json();
        } catch (error) {
            console.error('API请求错误:', error);
            throw new Error('查询失败，请稍后重试');
        }
    }

    static async getNews(query) {
        try {
            const response = await fetch(`/api/news?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('新闻获取失败');
            return await response.json();
        } catch (error) {
            console.error('新闻API错误:', error);
            throw new Error('获取新闻失败');
        }
    }
}

class StorageManager {
    static KEYS = {
        HISTORY: 'cedict_history',
        FAVORITES: 'cedict_favorites',
        NEWS_FAVORITES: 'cedict_news_favorites'
    };

    static getItem(key, defaultValue = []) {
        try {
            return JSON.parse(localStorage.getItem(key)) || defaultValue;
        } catch {
            return defaultValue;
        }
    }

    static setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('存储失败:', error);
        }
    }
}
