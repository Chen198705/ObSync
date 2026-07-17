const api = require('../../services/api.js');

Page({
  data: {
    isBound: false
  },

  onLoad() {
    this.checkBinding();
  },

  onShow() {
    this.checkBinding();
  },

  checkBinding() {
    const isBound = api.isBound();
    this.setData({ isBound });
  },

  goToBind() {
    wx.navigateTo({ url: '/pages/bind/bind' });
  },

  goToSave() {
    wx.navigateTo({ url: '/pages/save/save' });
  },

  goToArticles() {
    wx.navigateTo({ url: '/pages/articles/articles' });
  }
});
