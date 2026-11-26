# frozen_string_literal: true

require_relative "lib/vortex_sdk/version"

Gem::Specification.new do |spec|
  spec.name = "vortex-sdk"
  spec.version = VortexSDK::VERSION
  spec.authors = ["N.O Group"]
  spec.summary = "Vortex BaaS Ruby SDK — auth, database, realtime, storage, functions, billing"
  spec.license = "Apache-2.0"
  spec.required_ruby_version = Gem::Requirement.new(">= 3.0.0")

  spec.files = Dir.glob("{lib,spec}/**/*") + %w[README.md]
  spec.require_paths = ["lib"]

  spec.add_dependency "http", "~> 5.0"
  spec.add_dependency "websocket-client-simple", "~> 0.7"

  spec.add_development_dependency "rspec", "~> 3.0"
end
