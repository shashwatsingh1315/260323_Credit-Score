sed -i -e 's/page.select_option("select:has-text('\''Select Scenario'\'')", value="customer_name_customer_pays")/page.locator("select").nth(0).select_option(value="customer_name_customer_pays")/g' /home/jules/verification/verify_new_case_kam.py

sed -i -e 's/page.select_option("select:has-text('\''Select Customer'\'')", index=1)/page.locator("select").nth(1).select_option(index=1)/g' /home/jules/verification/verify_new_case_kam.py

sed -i -e 's/page.select_option("select:has-text('\''Select KAM'\'')", index=1)/page.locator("select").nth(2).select_option(index=1)/g' /home/jules/verification/verify_new_case_kam.py

sed -i -e 's/page.select_option("select:has-text('\''Select Branch'\'')", index=1)/page.locator("select").nth(3).select_option(index=1)/g' /home/jules/verification/verify_new_case_kam.py
