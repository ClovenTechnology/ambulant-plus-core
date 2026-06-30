package com.ambulant.patient;

import android.os.Bundle;

import com.ambulant.patient.plugins.health.HealthMonitorPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthMonitorPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
