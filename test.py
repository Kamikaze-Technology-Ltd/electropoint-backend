from playwright.sync_api import sync_playwright

FB_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36 FBAV/420.0.0.54.123"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        user_agent=FB_UA,
        viewport={"width": 360, "height": 740},
        java_script_enabled=True,
    )
    
    page = context.new_page()

    # Log console messages from the page
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

    # Intercept network requests (optional)
    def log_request(route, request):
        print("Request:", request.url)
        route.continue_()
    
    page.route("**/*", log_request)

    page.goto("https://bigvicstore.com")  # or your real domain
    # Try to wait for products to load
    try:
        page.wait_for_selector(".product-item", timeout=5000)
        print("Products loaded")
    except:
        print("Products did not load")

    browser.close()