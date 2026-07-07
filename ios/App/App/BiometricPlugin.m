#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BiometricPlugin, "BiometricPlugin",
           CAP_PLUGIN_METHOD(authenticate, CAPPluginReturnPromise);
)
