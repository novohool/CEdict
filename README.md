## 智能词典系统

### 环境配置
1. 安装依赖
```bash
pip install "fastapi[all]" uvicorn requests
```

### 启动服务
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 功能特性
- 自动下载词典数据库
- 中英双向查询
- 模糊搜索
- 实时查询

### 使用说明
1. 首次运行时会自动下载词典数据库（约300MB）
2. 访问 http://localhost:8000/static/index.html
3. 在搜索框输入中文或英文即可查询
