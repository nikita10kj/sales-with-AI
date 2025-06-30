# test_azure_redis.py
import redis

client = redis.Redis(
    host='salesredis.redis.cache.windows.net',
    port=6380,
    password='4JPY7Oj7e46UQ6OhMOUCX9zIREi8FdXaoAzCaFrSqdI=',
    ssl=True,
    ssl_cert_reqs=None
)

try:
    print(client.ping())
except redis.AuthenticationError:
    print("❌ Invalid username-password pair")
except Exception as e:
    print("❌ Other error:", e)
