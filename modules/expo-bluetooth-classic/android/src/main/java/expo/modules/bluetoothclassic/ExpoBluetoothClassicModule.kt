package expo.modules.bluetoothclassic

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoBluetoothClassicModule : Module() {

  private var bluetoothReceiver: BroadcastReceiver? = null
  private var isListening = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  private val bluetoothAdapter: BluetoothAdapter?
    get() {
      val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      return bluetoothManager?.adapter
    }

  override fun definition() = ModuleDefinition {

    Name("ExpoBluetoothClassic")

    // Events that JS can listen to
    Events(
      "onDeviceConnected",
      "onDeviceDisconnected",
      "onBluetoothStateChanged"
    )

    // ─── Get all paired/bonded Bluetooth devices ─────────────────────────
    // This returns devices from the phone's Bluetooth settings — both
    // Classic and BLE devices that have been paired.
    AsyncFunction("getBondedDevices") {
      val adapter = bluetoothAdapter
        ?: return@AsyncFunction emptyList<Bundle>()

      try {
        val bondedDevices = adapter.bondedDevices ?: emptySet()
        bondedDevices.map { device ->
          bundleOf(
            "id" to device.address,
            "name" to (device.name ?: "Unknown Device"),
            "address" to device.address,
            "type" to when (device.type) {
              BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
              BluetoothDevice.DEVICE_TYPE_LE -> "ble"
              BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
              else -> "unknown"
            },
            "bondState" to when (device.bondState) {
              BluetoothDevice.BOND_BONDED -> "bonded"
              BluetoothDevice.BOND_BONDING -> "bonding"
              else -> "none"
            }
          )
        }
      } catch (e: SecurityException) {
        // Missing BLUETOOTH_CONNECT permission on Android 12+
        emptyList<Bundle>()
      }
    }

    // ─── Check if a specific device is currently connected ───────────────
    // Checks Classic BT profiles (A2DP, Headset, HID) for active connection.
    AsyncFunction("isDeviceConnected") { address: String ->
      val adapter = bluetoothAdapter
        ?: return@AsyncFunction false

      try {
        val device = adapter.getRemoteDevice(address)
        // Check common Classic BT profiles
        val profilesToCheck = listOf(
          BluetoothProfile.A2DP,        // Audio streaming (car audio)
          BluetoothProfile.HEADSET,     // Hands-free
          BluetoothProfile.HID_DEVICE   // HID
        )

        for (profile in profilesToCheck) {
          val isConnected = try {
            // Use reflection to check connection state since getProfileProxy is async
            val method = device.javaClass.getMethod("isConnected")
            method.invoke(device) as? Boolean ?: false
          } catch (e: Exception) {
            false
          }
          if (isConnected) return@AsyncFunction true
        }
        false
      } catch (e: Exception) {
        false
      }
    }

    // ─── Start listening for BT connection events ────────────────────────
    // Registers a BroadcastReceiver for ACTION_ACL_CONNECTED and
    // ACTION_ACL_DISCONNECTED. These fire for Classic Bluetooth connections
    // (exactly what car audio systems use).
    AsyncFunction("startConnectionListener") {
      if (isListening) return@AsyncFunction true

      val filter = IntentFilter().apply {
        addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
        addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
        addAction(BluetoothDevice.ACTION_ACL_DISCONNECT_REQUESTED)
        addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
      }

      bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
          intent ?: return

          when (intent.action) {
            BluetoothDevice.ACTION_ACL_CONNECTED -> {
              val device = getDeviceFromIntent(intent) ?: return
              try {
                sendEvent("onDeviceConnected", bundleOf(
                  "id" to device.address,
                  "name" to (device.name ?: "Unknown"),
                  "address" to device.address
                ))
              } catch (e: SecurityException) {
                sendEvent("onDeviceConnected", bundleOf(
                  "id" to device.address,
                  "name" to "Unknown",
                  "address" to device.address
                ))
              }
            }

            BluetoothDevice.ACTION_ACL_DISCONNECTED,
            BluetoothDevice.ACTION_ACL_DISCONNECT_REQUESTED -> {
              val device = getDeviceFromIntent(intent) ?: return
              try {
                sendEvent("onDeviceDisconnected", bundleOf(
                  "id" to device.address,
                  "name" to (device.name ?: "Unknown"),
                  "address" to device.address
                ))
              } catch (e: SecurityException) {
                sendEvent("onDeviceDisconnected", bundleOf(
                  "id" to device.address,
                  "name" to "Unknown",
                  "address" to device.address
                ))
              }
            }

            BluetoothAdapter.ACTION_STATE_CHANGED -> {
              val state = intent.getIntExtra(
                BluetoothAdapter.EXTRA_STATE,
                BluetoothAdapter.ERROR
              )
              val stateStr = when (state) {
                BluetoothAdapter.STATE_ON -> "on"
                BluetoothAdapter.STATE_OFF -> "off"
                BluetoothAdapter.STATE_TURNING_ON -> "turning_on"
                BluetoothAdapter.STATE_TURNING_OFF -> "turning_off"
                else -> "unknown"
              }
              sendEvent("onBluetoothStateChanged", bundleOf(
                "state" to stateStr
              ))
            }
          }
        }
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(bluetoothReceiver, filter)
      }

      isListening = true
      true
    }

    // ─── Stop listening ──────────────────────────────────────────────────
    AsyncFunction("stopConnectionListener") {
      stopListening()
      true
    }

    // ─── Get current Bluetooth adapter state ─────────────────────────────
    AsyncFunction("getBluetoothState") {
      val adapter = bluetoothAdapter ?: return@AsyncFunction "unavailable"
      try {
        if (adapter.isEnabled) "on" else "off"
      } catch (e: SecurityException) {
        "unavailable"
      }
    }

    // ─── Cleanup on module destroy ───────────────────────────────────────
    OnDestroy {
      stopListening()
    }
  }

  private fun stopListening() {
    if (isListening && bluetoothReceiver != null) {
      try {
        context.unregisterReceiver(bluetoothReceiver)
      } catch (e: Exception) {
        // Already unregistered
      }
      bluetoothReceiver = null
      isListening = false
    }
  }

  @Suppress("DEPRECATION")
  private fun getDeviceFromIntent(intent: Intent): BluetoothDevice? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
  }
}
