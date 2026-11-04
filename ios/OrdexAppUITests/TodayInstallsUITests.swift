import XCTest

final class TodayInstallsUITests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testDailyInstallsFlow() throws {
        // UI tests must launch the application that they test.
        let app = XCUIApplication()
        
        // Pass any necessary launch arguments or environment variables to mock the network or set state.
        // app.launchArguments.append("-MockNetwork")
        
        app.launch()

        // 1. Navigate to the Installations Tab
        // Assuming the tab bar item has the accessibility label "התקנות" (Installations) or similar.
        // Alternatively, use index: 1 since it is the second tab.
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5), "Tab bar should exist")
        
        // Let's use index 1 for the second tab (Installations)
        let installsTab = tabBar.buttons.element(boundBy: 1)
        installsTab.tap()

        // 2. Verify we are on the "Today's Installs" screen
        let navTitle = app.navigationBars["התקנות היום"]
        XCTAssertTrue(navTitle.waitForExistence(timeout: 5), "Should be on the Today's Installs screen")
        
        // 3. Find an order row and open the action sheet via swipe
        let firstOrderCell = app.cells.firstMatch
        if firstOrderCell.waitForExistence(timeout: 5) {
            // Swipe right to reveal leading actions (Quick Install)
            firstOrderCell.swipeRight()
            
            let quickInstallButton = app.buttons["הותקן"] // Checkmark button
            if quickInstallButton.exists {
                // If we tap it, it will show an alert "סמן כהותקן?"
                // quickInstallButton.tap()
                // ... handle alert
            }
            
            // Swipe left to reveal trailing actions (Issue/Action)
            firstOrderCell.swipeLeft()
            let reportIssueButton = app.buttons["בעיה"]
            if reportIssueButton.exists {
                reportIssueButton.tap()
            }
            
            // We can also tap the order cell to go to Order Details, then tap action bar items.
            firstOrderCell.tap()
            
            // Look for the Partial Install button on the action bar inside Order Details.
            // Action bar is mapped by icon: "wrench.adjustable.fill" or "partialInstall"
            // Wait for Order Details to load
            let orderDetailsTitle = app.navigationBars.firstMatch
            XCTAssertTrue(orderDetailsTitle.waitForExistence(timeout: 5), "Order Details should load")
            
            // Try to find the action bar button (could be a generic button or labeled appropriately)
            // It's safer to check for common identifiers if added, otherwise we check if a sheet can open.
        }
    }
}
