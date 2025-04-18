// 调试辅助函数
function debugAPI(url, data) {
    console.log(`API调用: ${url}`);
    console.log('返回数据:', data);
    
    // 将调试信息添加到页面
    const debugContainer = document.getElementById('debugInfo');
    if (debugContainer) {
        const debugItem = document.createElement('div');
        debugItem.className = 'debug-item';
        debugItem.innerHTML = `
            <h4>API调用: ${url}</h4>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        `;
        debugContainer.appendChild(debugItem);
    }
}

// 修改fetchRelatedNews函数，添加调试信息
async function debugFetchRelatedNews(word) {
    if (!word.trim()) {
        return;
    }
    
    try {
        // 显示调试信息
        const debugContainer = document.getElementById('debugInfo');
        if (debugContainer) {
            debugContainer.innerHTML += `<div>正在获取新闻: ${word}</div>`;
        }
        
        // 构建API请求URL
        const url = `/api/news?query=${encodeURIComponent(word.trim())}&count=3`;
        
        // 发送请求
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`新闻API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        debugAPI(url, data);
        
        return data;
    } catch (error) {
        console.error('获取新闻失败:', error);
        
        // 显示错误信息
        const debugContainer = document.getElementById('debugInfo');
        if (debugContainer) {
            debugContainer.innerHTML += `<div class="error">获取新闻失败: ${error.message}</div>`;
        }
        
        return { error: error.message };
    }
}

// 修改searchWord函数，添加调试信息
async function debugSearchWord(word) {
    if (!word.trim()) {
        return;
    }
    
    try {
        // 显示调试信息
        const debugContainer = document.getElementById('debugInfo');
        if (debugContainer) {
            debugContainer.innerHTML += `<div>正在搜索单词: ${word}</div>`;
        }
        
        // 构建API请求URL
        const url = `/api/word/${encodeURIComponent(word.trim())}`;
        
        // 发送请求
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`词典API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        debugAPI(url, data);
        
        return data;
    } catch (error) {
        console.error('搜索单词失败:', error);
        
        // 显示错误信息
        const debugContainer = document.getElementById('debugInfo');
        if (debugContainer) {
            debugContainer.innerHTML += `<div class="error">搜索单词失败: ${error.message}</div>`;
        }
        
        return { error: error.message };
    }
}

// 添加调试样式
function addDebugStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #debugInfo {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .debug-item {
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px dashed #ccc;
        }
        
        .debug-item h4 {
            margin: 0 0 10px 0;
            color: #4361ee;
        }
        
        .debug-item pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        .error {
            color: #f72585;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

// 初始化调试环境
function initDebug() {
    // 添加调试样式
    addDebugStyles();
    
    // 创建调试容器
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debugInfo';
    debugContainer.innerHTML = '<h3>调试信息</h3>';
    
    // 添加到页面
    document.body.appendChild(debugContainer);
    
    console.log('调试环境已初始化');
}

// 导出调试函数
window.debugAPI = {
    init: initDebug,
    fetchNews: debugFetchRelatedNews,
    searchWord: debugSearchWord
};
