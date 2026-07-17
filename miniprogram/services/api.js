const API_BASE_URL = 'https://wechat-obsync.mindover.us.kg';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.userId = wx.getStorageSync('userId') || '';
    this.token = wx.getStorageSync('token') || '';
  }

  saveUserId(userId) {
    this.userId = userId;
    wx.setStorageSync('userId', userId);
    console.log('Saved userId:', userId);
  }

  isBound() {
    const bound = !!this.userId && !!this.token;
    console.log('isBound check:', { userId: this.userId, token: this.token, bound });
    return bound;
  }

  async confirmBind(code) {
    console.log('confirmBind called with code:', code);
    console.log('userId:', this.userId);
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.baseUrl + '/v1/bind/confirm',
        method: 'POST',
        data: {
          code: code,
          userId: this.userId
        },
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log('wx.request success:', res);
          console.log('statusCode:', res.statusCode);
          console.log('data:', res.data);
          console.log('data type:', typeof res.data);
          
          if (res.statusCode === 200) {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            console.log('parsed data:', data);
            
            if (data.success) {
              this.token = data.token;
              this.userId = data.userId || this.userId;
              wx.setStorageSync('token', this.token);
              wx.setStorageSync('userId', this.userId);
              console.log('Bind success, saved token:', this.token);
              resolve({ success: true });
            } else if (data.error === '绑定码已使用') {
              console.log('Already bound');
              resolve({ success: true, message: '已经绑定过了' });
            } else {
              console.log('Bind failed:', data.error);
              resolve({ success: false, error: data.error || '绑定失败' });
            }
          } else {
            console.log('HTTP error:', res.statusCode);
            resolve({ success: false, error: '请求失败: ' + res.statusCode });
          }
        },
        fail: (err) => {
          console.error('wx.request fail:', err);
          resolve({ success: false, error: err.errMsg || '网络错误' });
        }
      });
    });
  }

  async saveArticle(article) {
    if (!this.userId) {
      return { success: false, error: '请先绑定 Obsidian' };
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: this.baseUrl + '/v1/articles/save',
        method: 'POST',
        data: {
          userId: this.userId,
          title: article.title,
          sourceUrl: article.url,
          account: article.account,
          author: article.author,
          markdown: article.content || '',
          autoFetch: article.autoFetch !== false
        },
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log('saveArticle response:', res);
          if (res.statusCode === 200) {
            resolve({ success: true, data: res.data });
          } else {
            resolve({ success: false, error: '保存失败' });
          }
        },
        fail: (err) => {
          console.error('saveArticle fail:', err);
          resolve({ success: false, error: err.errMsg || '网络错误' });
        }
      });
    });
  }

  async getArticles() {
    if (!this.userId) return [];

    return new Promise((resolve, reject) => {
      wx.request({
        url: this.baseUrl + '/v1/articles/list?userId=' + this.userId,
        method: 'GET',
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data.articles || []);
          }
          resolve([]);
        },
        fail: (err) => {
          console.error('getArticles fail:', err);
          resolve([]);
        }
      });
    });
  }
}

module.exports = new ApiService();
