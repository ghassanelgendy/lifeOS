import Foundation
import Capacitor
import LocalAuthentication

@objc(BiometricPlugin)
public class BiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricPlugin"
    public let jsName = "BiometricPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Authenticate to access this section"
        let context = LAContext()
        var error: NSError?

        // Check if biometrics (Face ID/Touch ID) or passcode is configured and available
        if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, evaluateError in
                DispatchQueue.main.async {
                    if success {
                        call.resolve([
                            "success": true
                        ])
                    } else {
                        let code = (evaluateError as NSError?)?.code ?? 0
                        let message = evaluateError?.localizedDescription ?? "Authentication failed"
                        call.reject(message, "\(code)", evaluateError)
                    }
                }
            }
        } else {
            let code = (error as NSError?)?.code ?? 0
            let message = error?.localizedDescription ?? "Biometrics not available"
            call.reject(message, "\(code)", error)
        }
    }
}
