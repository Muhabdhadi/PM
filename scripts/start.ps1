docker build -t pm-app .
docker run -d --name pm-app -p 8000:8000 -e OPENROUTER_API_KEY=$env:OPENROUTER_API_KEY pm-app
