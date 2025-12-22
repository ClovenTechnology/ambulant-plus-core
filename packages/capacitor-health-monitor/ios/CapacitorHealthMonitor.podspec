Pod::Spec.new do |s|
  s.name             = 'CapacitorHealthMonitor'
  s.version          = '0.0.1'
  s.summary          = 'Capacitor plugin for DueCare 6-in-1 Health Monitor'
  s.license          = { :type => 'Proprietary', :text => 'For use with licensed SDKs' }
  s.author           = { 'Ambulant' => 'dev@ambulant.plus' }
  s.homepage         = 'https://example.invalid'
  s.source           = { :path => '.' }

  s.platform     = :ios, '13.0'
  s.swift_version = '5.8'

  # Include your Swift plugin sources
  s.source_files = 'Plugin/**/*.{swift,h,m}'

  # Vendor SDK placements inside the plugin
  s.vendored_libraries = 'Vendor/lib/libLibHealthCombine_4.4.a'
  s.resources          = 'Vendor/Heads/LibHealthCombine.bundle'
  s.preserve_paths     = 'Vendor/Heads/**/*'
  s.header_mappings_dir = 'Vendor/Heads'

  # Build settings pushed into the plugin target
  s.pod_target_xcconfig = {
    'SWIFT_OBJC_BRIDGING_HEADER' => 'Plugin/Bridging-Header.h',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES',
    'HEADER_SEARCH_PATHS' => '$(PODS_TARGET_SRCROOT)/Vendor/Heads',
    'LIBRARY_SEARCH_PATHS' => '$(PODS_TARGET_SRCROOT)/Vendor/lib',
    'OTHER_LDFLAGS' => '-ObjC'
  }

  # Capacitor dependency
  s.dependency 'Capacitor', '~> 5.0'
end
