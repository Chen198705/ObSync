const api = require('../../services/api.js');

function generateUserId() {
  return 'usr_' + Math.random().toString(36).substring(2, 15);
}

Page({
  data: {
    bindCode: '',
    loading: false
  },

  onLoad() {
    // 初始化用户ID
    if (!api.userId) {
      api.saveUserId(generateUserId());
    }
  },

  onCodeInput(e) {
    this.setData({ bindCode: e.detail.value.toUpperCase() });
  },

  async confirmBind() {
    const { bindCode } = this.data;
    
    if (!bindCode || bindCode.length < 6) {
      wx.showToast({ title: '请输入正确的绑定码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await api.confirmBind(bindCode);
      
      if (result.success) {
        // token 已经在 api.confirmBind 中保存了
        wx.showToast({ title: '绑定成功！', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: result.error || '绑定失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
