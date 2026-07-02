package com.ambulant.patient;

import android.os.Bundle;

import com.ambulant.patient.plugins.health.HealthMonitorPlugin;
import com.ambulant.patient.plugins.otoscope.OtoscopePlugin;
import com.ambulant.patient.plugins.ring.NexRingPlugin;
import com.ambulant.patient.plugins.steth.DigitalStethoscopePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthMonitorPlugin.class);
    registerPlugin(DigitalStethoscopePlugin.class);
    registerPlugin(OtoscopePlugin.class);
    registerPlugin(NexRingPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
