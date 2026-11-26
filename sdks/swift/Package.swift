// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "VortexSwift",
    platforms: [.macOS(.v12), .iOS(.v15)],
    products: [
        .library(name: "VortexSwift", targets: ["VortexSwift"])
    ],
    dependencies: [],
    targets: [
        .target(name: "VortexSwift")
    ]
)
