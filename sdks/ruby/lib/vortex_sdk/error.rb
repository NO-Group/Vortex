module VortexSDK
  class Error < StandardError
    attr_reader :status, :code

    def initialize(status, code, message)
      super(message)
      @status = status
      @code = code
    end
  end
end
