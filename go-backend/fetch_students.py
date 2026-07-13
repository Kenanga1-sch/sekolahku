import requests
import json

r = requests.get('http://localhost:8181/api/master/students?classId=hah1516t84ehrxvz97w6kdt0&limit=100&status=active')
print("Status Code:", r.status_code)
try:
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print("Response text:", r.text)
