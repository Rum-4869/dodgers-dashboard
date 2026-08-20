import requests

# 🎯 大谷翔平選手（ID: 660271）の「今年の打撃成績」をもらう裏口URL
url = "https://statsapi.mlb.com/api/v1/people/660271?hydrate=stats(group=[hitting],type=[season])"

print("🦄 大谷選手の今年の成績を取得中...\n")

response = requests.get(url)
data = response.json()

# 📦 またJSONのマトリョーシカ（入れ子）を開けていくよ！
try:
    player_info = data["people"][0]
    name = player_info["fullName"]
    
    # 成績データが入っている一番奥の箱まで一気に開ける！
    stats = player_info["stats"][0]["splits"][0]["stat"]
    
    avg = stats["avg"]           # 打率
    hr = stats["homeRuns"]       # ホームラン
    rbi = stats["rbi"]           # 打点
    ops = stats["ops"]           # OPS
    sb = stats["stolenBases"]    # 盗塁

    print(f"⚾️ 選手名: {name}")
    print(f"🔥 打率: {avg}")
    print(f"🚀 ホームラン: {hr} 本")
    print(f"💨 盗塁: {sb} 個")
    print(f"💪 打点: {rbi}")
    print(f"✨ OPS: {ops}")
    print("\n✅ APIからのデータ取得大成功！！")

except Exception as e:
    print(f"⚠️ エラーが起きちゃった: {e}")