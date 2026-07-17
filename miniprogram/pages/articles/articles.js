const api = require('../../services/api.js');

Page({
  data: {
    articles: []
  },

  onLoad() {
    this.loadArticles();
  },

  onShow() {
    this.loadArticles();
  },

  async loadArticles() {
    const articles = await api.getArticles();
    
    // 格式化时间
    articles.forEach(article => {
      if (article.savedAt) {
        const date = new Date(article.savedAt);
        article.savedAt = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      }
    });

    this.setData({ articles });
  }
});
