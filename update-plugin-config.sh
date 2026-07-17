#!/bin/bash
# 更新 Obsidian 插件配置
# 用法: ./update-plugin-config.sh https://your-workers.workers.dev

if [ -z "$1" ]; then
  echo "用法: ./update-plugin-config.sh <API_URL>"
  echo "例如: ./update-plugin-config.sh https://my-obsync.workers.dev"
  exit 1
fi

API_URL="$1"
PLUGIN_DIR="$HOME/Documents/Obsidian Vault/.obsidian/plugins/wechat-obsync"
DATA_FILE="$PLUGIN_DIR/data.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "错误: 找不到插件配置文件: $DATA_FILE"
  exit 1
fi

# 更新 apiBaseUrl
cat > "$DATA_FILE" << DATAEOF
{
  "settingsVersion": 3,
  "apiBaseUrl": "${API_URL}",
  "token": "",
  "userId": "",
  "syncFolder": "raw",
  "deviceName": "Obsidian",
  "syncIntervalMinutes": 1,
  "localizeImages": true
}
DATAEOF

echo "✅ 插件配置已更新!"
echo "   API URL: $API_URL"
echo "   请重新启动 Obsidian 并重新绑定"
