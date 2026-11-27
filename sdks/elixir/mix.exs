defmodule VortexSDK.MixProject do
  use Mix.Project

  def project do
    [
      app: :vortex_sdk,
      version: "1.0.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      elixirc_options: [runtime: false]
    ]
  end

  def application do
    [extra_applications: [:logger, :inets, :ssl]]
  end

  defp deps do
    [
      {:req, "~> 0.18"}
    ]
  end
end
