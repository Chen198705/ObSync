const api = require('../../services/api.js');

Page({
  data: {
    article: {
      title: '',
      url: '',
      account: '',
      author: ''
    },
    autoFetch: true,  // 默认开启自动抓取
    loading: false,
    fetchedTitle: '',  // 后端抓取的标题
    saveSuccess: false
  },

  onLoad(options) {
    this.getArticleFromClipboard();
  },

  async getArticleFromClipboard() {
    try {
      const res = await wx.getClipboardData();
      if (res.data && res.data.includes('mp.weixin.qq.com')) {
        this.setData({
          'article.url': res.data
        });
      }
    } catch (err) {
      console.error('获取剪贴板失败:', err);
    }
  },

  onAutoFetchChange(e) {
    this.setData({ autoFetch: e.detail.value });
  },

  async saveArticle() {
    const { article, autoFetch } = this.data;

    if (!article.url) {
      wx.showToast({ title: '请先粘贴文章链接', icon: 'none' });
      return;
    }

    if (!article.url.includes('mp.weixin.qq.com')) {
      wx.showToast({ title: '仅支持微信文章链接', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await api.saveArticle({
        title: '',  // 不传标题，让后端抓取
        url: article.url,
        account: '',
        author: '',
        content: '',
        autoFetch: autoFetch
      });

      if (result.success) {
        // 显示后端抓取的标题
        if (result.data?.title) {
          this.setData({ 
            fetchedTitle: result.data.title,
            saveSuccess: true 
          });
        }
        wx.showToast({ title: '保存成功！', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({ title: result.error || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
