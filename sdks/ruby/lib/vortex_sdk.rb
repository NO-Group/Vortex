# frozen_string_literal: true

require_relative "vortex_sdk/version"
require_relative "vortex_sdk/client"
require_relative "vortex_sdk/error"

module VortexSDK
  class << self
    def client(url, token: nil, timeout: 30)
      VortexSDK::Client.new(url, token: token, timeout: timeout)
    end
  end
end
