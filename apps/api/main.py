from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="TechnoPeace API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def index():
    return HTMLResponse(
        """
        <html>
          <head><title>TechnoPeace API</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px;">
            <h1>TechnoPeace API</h1>
            <p>Signals and reflect-lite backend. Health check is available at <code>/health</code>.</p>
          </body>
        </html>
        """
    )
