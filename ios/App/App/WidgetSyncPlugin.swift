import Foundation
import Capacitor
import WidgetKit

@objc(WidgetSyncPlugin)
public class WidgetSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetSyncPlugin"
    public let jsName = "WidgetSyncPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncHabitStreaks", returnType: CAPPluginReturnPromise)
    ]

    @objc func syncHabitStreaks(_ call: CAPPluginCall) {
        guard let streaksData = call.getObject("streaks") else {
            call.reject("Missing streaks object")
            return
        }
        
        let appGroupId = "group.com.ghassanelgendy.lifeos"
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("Unable to access App Group: \(appGroupId)")
            return
        }
        
        // Save streaks data dictionary
        defaults.set(streaksData, forKey: "habitStreaks")
        defaults.synchronize()
        
        // Reload all WidgetKit timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        call.resolve([
            "success": true
        ])
    }
}
