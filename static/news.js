// 新闻API功能
class NewsAPI {
    constructor() {
        // 使用Twitter API搜索相关新闻
        this.apiBaseUrl = '/api/news';
        
        // 本地存储键
        this.NEWS_FAVORITES_KEY = 'cedict_news_favorites';
        
        // 获取收藏的新闻
        this.favorites = JSON.parse(localStorage.getItem(this.NEWS_FAVORITES_KEY) || '[]');
    }

    // 获取与关键词相关的新闻
    async getNews(keyword, count = 3) {
        try {
            // 构建API请求URL
            const url = `${this.apiBaseUrl}?query=${encodeURIComponent(keyword)}&count=${count}`;
            
            // 发送请求
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`新闻API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('获取新闻失败:', error);
            return { error: error.message };
        }
    }
    
    // 检查新闻是否已收藏
    isFavorite(newsId) {
        return this.favorites.some(item => item.id === newsId);
    }
    
    // 切换新闻收藏状态
    toggleFavorite(newsItem) {
        const index = this.favorites.findIndex(item => item.id === newsItem.id);
        
        if (index === -1) {
            // 添加到收藏
            this.favorites.push({
                ...newsItem,
                timestamp: new Date().toISOString()
            });
        } else {
            // 从收藏中移除
            this.favorites.splice(index, 1);
        }
        
        // 更新本地存储
        this.updateLocalStorage();
        
        return index === -1; // 返回是否已添加到收藏
    }
    
    // 更新本地存储
    updateLocalStorage() {
        localStorage.setItem(this.NEWS_FAVORITES_KEY, JSON.stringify(this.favorites));
    }
    
    // 渲染新闻卡片
    renderNewsCards(newsData, container) {
        if (!newsData || newsData.error || !newsData.result || !newsData.result.timeline) {
            container.innerHTML = '<div class="news-error">暂无相关新闻</div>';
            return;
        }
        
        try {
            // 清空容器
            container.innerHTML = '';
            
            // 获取新闻条目
            let newsItems = [];
            const instructions = newsData.result.timeline.instructions || [];
            
            for (const instruction of instructions) {
                if (instruction.entries) {
                    for (const entry of instruction.entries) {
                        if (entry.content && entry.content.items) {
                            for (const item of entry.content.items) {
                                if (item.item && 
                                    item.item.itemContent && 
                                    item.item.itemContent.user_results && 
                                    item.item.itemContent.user_results.result) {
                                    
                                    const userResult = item.item.itemContent.user_results.result;
                                    
                                    if (userResult.legacy) {
                                        newsItems.push({
                                            id: userResult.rest_id || '',
                                            name: userResult.legacy.name || '',
                                            username: userResult.legacy.screen_name || '',
                                            profileImage: userResult.legacy.profile_image_url_https || '',
                                            description: userResult.legacy.description || '',
                                            verified: userResult.is_blue_verified || false
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // 限制显示数量
            newsItems = newsItems.slice(0, 3);
            
            if (newsItems.length === 0) {
                container.innerHTML = '<div class="news-error">暂无相关新闻</div>';
                return;
            }
            
            // 创建新闻卡片
            const newsCardsHTML = newsItems.map(item => {
                const isFavorited = this.isFavorite(item.id);
                
                return `
                <div class="news-card" data-id="${item.id}">
                <div class="news-card-header">
                        <img src="${item.profileImage}" alt="${item.name}" class="news-profile-image">
                        <div class="news-user-info">
                            <div class="news-name">
                                ${item.name}
                                ${item.verified ? '<span class="news-verified"><i class="fas fa-check-circle"></i></span>' : ''}
                            </div>
                            <div class="news-username">@${item.username}</div>
                        </div>
                        <button class="news-favorite-btn ${isFavorited ? 'active' : ''}" data-id="${item.id}">
                            <i class="fas fa-bookmark"></i>
                        </button>
                    </div>
                    <div class="news-content">${item.description}</div>
                </div>
                `;
            }).join('');
            
            container.innerHTML = `
                <div class="news-header">
                    <h3 class="news-section-title">相关新闻</h3>
                    <button id="newsFavoritesBtn" class="news-favorites-btn" title="收藏的新闻">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
                <div class="news-cards-container">
                    ${newsCardsHTML}
                </div>
            `;
            
            // 存储新闻项目以供收藏使用
            this.currentNewsItems = newsItems;
            
            // 添加收藏按钮事件
            document.querySelectorAll('.news-favorite-btn').forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击事件
                    
                    const newsId = btn.dataset.id;
                    const newsItem = newsItems.find(item => item.id === newsId);
                    
                    if (newsItem) {
                        const isNowFavorite = this.toggleFavorite(newsItem);
                        
                        if (isNowFavorite) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    }
                });
            });
            
            // 添加查看收藏新闻按钮事件
            const newsFavoritesBtn = document.getElementById('newsFavoritesBtn');
            if (newsFavoritesBtn) {
                newsFavoritesBtn.addEventListener('click', () => {
                    this.showFavoriteNews(container);
                });
            }
            
            // 添加卡片点击事件
            document.querySelectorAll('.news-card').forEach(card => {
                card.addEventListener('click', () => {
                    const username = card.querySelector('.news-username').textContent.substring(1);
                    window.open(`https://twitter.com/${username}`, '_blank');
                });
            });
            
        } catch (error) {
            console.error('渲染新闻卡片失败:', error);
            container.innerHTML = '<div class="news-error">新闻加载失败</div>';
        }
    }
    
    // 显示收藏的新闻
    showFavoriteNews(container) {
        try {
            // 清空容器
            container.innerHTML = '';
            
            if (this.favorites.length === 0) {
                container.innerHTML = '<div class="news-error">暂无收藏的新闻</div>';
                return;
            }
            
            // 创建新闻卡片
            const newsCardsHTML = this.favorites.map(item => `
                <div class="news-card" data-id="${item.id}">
                    <div class="news-card-header">
                        <img src="${item.profileImage}" alt="${item.name}" class="news-profile-image">
                        <div class="news-user-info">
                            <div class="news-name">
                                ${item.name}
                                ${item.verified ? '<span class="news-verified"><i class="fas fa-check-circle"></i></span>' : ''}
                            </div>
                            <div class="news-username">@${item.username}</div>
                        </div>
                        <button class="news-favorite-btn active" data-id="${item.id}">
                            <i class="fas fa-bookmark"></i>
                        </button>
                    </div>
                    <div class="news-content">${item.description}</div>
                </div>
            `).join('');
            
            container.innerHTML = `
                <div class="news-header">
                    <h3 class="news-section-title">收藏的新闻</h3>
                    <button id="newsBackBtn" class="news-back-btn" title="返回">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                </div>
                <div class="news-cards-container">
                    ${newsCardsHTML}
                </div>
            `;
            
            // 添加返回按钮事件
            const newsBackBtn = document.getElementById('newsBackBtn');
            if (newsBackBtn && this.lastSearchKeyword) {
                newsBackBtn.addEventListener('click', async () => {
                    // 重新获取最近搜索的新闻
                    const newsData = await this.getNews(this.lastSearchKeyword);
                    this.renderNewsCards(newsData, container);
                });
            }
            
            // 添加收藏按钮事件
            document.querySelectorAll('.news-favorite-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡，避免触发卡片点击事件
                    
                    const newsId = btn.dataset.id;
                    const newsItem = this.favorites.find(item => item.id === newsId);
                    
                    if (newsItem) {
                        this.toggleFavorite(newsItem);
                        // 重新显示收藏列表
                        this.showFavoriteNews(container);
                    }
                });
            });
            
            // 添加卡片点击事件
            document.querySelectorAll('.news-card').forEach(card => {
                card.addEventListener('click', () => {
                    const username = card.querySelector('.news-username').textContent.substring(1);
                    window.open(`https://twitter.com/${username}`, '_blank');
                });
            });
            
        } catch (error) {
            console.error('显示收藏新闻失败:', error);
            container.innerHTML = '<div class="news-error">加载收藏新闻失败</div>';
        }
    }
    
    // 设置最近搜索的关键词
    setLastSearchKeyword(keyword) {
        this.lastSearchKeyword = keyword;
    }
}

// 导出NewsAPI类
window.NewsAPI = NewsAPI;
