import ExpoModulesCore
import ExternalAccessory
import CoreBluetooth

public class ExpoBluetoothClassicModule: Module {
  
  private var centralManager: CBCentralManager?
  private var centralManagerDelegate: BluetoothCentralDelegate?
  private var accessoryObservers: [NSObjectProtocol] = []
  private var isListening = false
  
  public func definition() -> ModuleDefinition {
    
    Name("ExpoBluetoothClassic")
    
    Events(
      "onDeviceConnected",
      "onDeviceDisconnected",
      "onBluetoothStateChanged"
    )
    
    // ─── Get connected External Accessories (Classic BT) ─────────────
    // On iOS, we can only see *currently connected* Classic BT accessories
    // via ExternalAccessory framework. Unlike Android, there's no
    // "bonded devices" list for Classic BT.
    // We combine with CoreBluetooth for BLE peripherals.
    AsyncFunction("getBondedDevices") { () -> [[String: Any]] in
      var devices: [[String: Any]] = []
      
      // Get connected Classic BT accessories via ExternalAccessory
      let accessories = EAAccessoryManager.shared().connectedAccessories
      for accessory in accessories {
        devices.append([
          "id": String(accessory.connectionID),
          "name": accessory.name,
          "address": String(accessory.connectionID),
          "type": "classic",
          "bondState": "bonded"
        ])
      }
      
      return devices
    }
    
    // ─── Check if a specific device is connected ─────────────────────
    AsyncFunction("isDeviceConnected") { (address: String) -> Bool in
      // Check ExternalAccessory connected accessories
      let accessories = EAAccessoryManager.shared().connectedAccessories
      for accessory in accessories {
        if String(accessory.connectionID) == address || accessory.name == address {
          return true
        }
      }
      return false
    }
    
    // ─── Start listening for connection events ───────────────────────
    AsyncFunction("startConnectionListener") { () -> Bool in
      guard !self.isListening else { return true }
      
      // Listen for ExternalAccessory connect/disconnect
      EAAccessoryManager.shared().registerForLocalNotifications()
      
      let connectObserver = NotificationCenter.default.addObserver(
        forName: .EAAccessoryDidConnect,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let accessory = notification.userInfo?[EAAccessoryKey] as? EAAccessory else { return }
        self?.sendEvent("onDeviceConnected", [
          "id": String(accessory.connectionID),
          "name": accessory.name,
          "address": String(accessory.connectionID)
        ])
      }
      
      let disconnectObserver = NotificationCenter.default.addObserver(
        forName: .EAAccessoryDidDisconnect,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let accessory = notification.userInfo?[EAAccessoryKey] as? EAAccessory else { return }
        self?.sendEvent("onDeviceDisconnected", [
          "id": String(accessory.connectionID),
          "name": accessory.name,
          "address": String(accessory.connectionID)
        ])
      }
      
      self.accessoryObservers = [connectObserver, disconnectObserver]
      
      // Initialize CoreBluetooth for BLE state monitoring
      self.centralManagerDelegate = BluetoothCentralDelegate { [weak self] state in
        let stateStr: String
        switch state {
        case .poweredOn: stateStr = "on"
        case .poweredOff: stateStr = "off"
        default: stateStr = "unavailable"
        }
        self?.sendEvent("onBluetoothStateChanged", ["state": stateStr])
      }
      self.centralManager = CBCentralManager(
        delegate: self.centralManagerDelegate,
        queue: nil,
        options: [CBCentralManagerOptionShowPowerAlertKey: false]
      )
      
      self.isListening = true
      return true
    }
    
    // ─── Stop listening ──────────────────────────────────────────────
    AsyncFunction("stopConnectionListener") { () -> Bool in
      self.stopListening()
      return true
    }
    
    // ─── Get Bluetooth state ─────────────────────────────────────────
    AsyncFunction("getBluetoothState") { () -> String in
      if let manager = self.centralManager {
        switch manager.state {
        case .poweredOn: return "on"
        case .poweredOff: return "off"
        default: return "unavailable"
        }
      }
      
      // Create a temporary manager to check state
      let tempDelegate = BluetoothCentralDelegate(onStateChange: nil)
      let tempManager = CBCentralManager(
        delegate: tempDelegate,
        queue: nil,
        options: [CBCentralManagerOptionShowPowerAlertKey: false]
      )
      
      // CBCentralManager state is available synchronously after init
      switch tempManager.state {
      case .poweredOn: return "on"
      case .poweredOff: return "off"
      default: return "unavailable"
      }
    }
    
    OnDestroy {
      self.stopListening()
    }
  }
  
  private func stopListening() {
    guard isListening else { return }
    
    for observer in accessoryObservers {
      NotificationCenter.default.removeObserver(observer)
    }
    accessoryObservers.removeAll()
    
    EAAccessoryManager.shared().unregisterForLocalNotifications()
    
    centralManager = nil
    centralManagerDelegate = nil
    isListening = false
  }
}

// ─── CoreBluetooth delegate for state monitoring ───────────────────────
private class BluetoothCentralDelegate: NSObject, CBCentralManagerDelegate {
  var onStateChange: ((CBManagerState) -> Void)?
  
  init(onStateChange: ((CBManagerState) -> Void)?) {
    self.onStateChange = onStateChange
  }
  
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    onStateChange?(central.state)
  }
}
