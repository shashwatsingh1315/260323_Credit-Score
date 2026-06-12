from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(record_video_dir="/home/jules/verification/videos/")
        page = context.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_timeout(2000) # Give it time to load/redirect
        page.screenshot(path="/home/jules/verification/screenshots/verification.png", full_page=True)
        context.close()
        browser.close()

if __name__ == "__main__":
    run()
