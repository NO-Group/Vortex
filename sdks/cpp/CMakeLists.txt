cmake_minimum_required(VERSION 3.14)
project(vortex-cpp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

add_library(vortex STATIC
    src/vortex.cpp
    src/vortex.h
)

target_include_directories(vortex PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(vortex PUBLIC OpenSSL::SSL OpenSSL::Crypto Threads::Threads)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(vortex PRIVATE -Wall -Wextra)
endif()

install(TARGETS vortex ARCHIVE DESTINATION lib)
install(DIRECTORY src/ DESTINATION include/vortex)
