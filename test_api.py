import urllib.request
import json

try:
    req = urllib.request.Request('https://www.sdn1kenanga.sch.id/api/public/school-settings', headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode())
    print("SUCCESS: Status 200 OK")
    print(data)
except Exception as e:
    print("ERROR:", e)
