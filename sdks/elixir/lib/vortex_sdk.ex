defmodule VortexSDK do
  @moduledoc """
  Vortex BaaS Elixir SDK.

  ```elixir
  {:ok, vortex} = VortexSDK.Client.new("https://your-vortex.example.com")
  {:ok, session} = vortex.auth().signup("user@example.com", "password")
  ```
  """

  alias VortexSDK.{Client, Auth, Database, Storage, Functions, Apps, Billing, Admin, Http}

  defstruct client: nil

  @spec new(String.t()) :: {:ok, Client.t()} | {:error, String.t()}
  def new(url) do
    case Client.new(url) do
      {:ok, c} -> {:ok, c}
      {:error, e} -> {:error, e}
    end
  end
end
