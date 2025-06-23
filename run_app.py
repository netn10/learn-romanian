#!/usr/bin/env python3
"""
Script to run both the Flask backend and React frontend for the Romanian flashcards app.
"""

import os
import subprocess
import sys
import time
import signal
import platform
from pathlib import Path


def load_env_vars():
    """Load environment variables from .env file"""
    env_file = Path(__file__).parent / ".env"
    env_vars = {}

    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    env_vars[key] = value

    return env_vars


def check_requirements():
    """Check if Python and Node.js are available"""
    try:
        # Check Python
        result = subprocess.run(
            [sys.executable, "--version"], capture_output=True, text=True
        )
        print(f"✓ Python found: {result.stdout.strip()}")
    except Exception as e:
        print(f"✗ Python not found: {e}")
        return False

    try:
        # Check Node.js
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        print(f"✓ Node.js found: {result.stdout.strip()}")
    except Exception as e:
        print(f"✗ Node.js not found: {e}")
        print("Please install Node.js from https://nodejs.org/")
        return False

    try:
        # Check npm
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
        print(f"✓ npm found: {result.stdout.strip()}")
    except Exception as e:
        print(f"✗ npm not found: {e}")
        return False

    return True


def check_mongodb():
    """Check if MongoDB is running using URI from .env file"""
    try:
        import pymongo

        # Load environment variables
        env_vars = load_env_vars()
        mongo_uri = env_vars.get("MONGO_URI", "mongodb://localhost:27017/")

        # Mask credentials for display
        display_uri = mongo_uri
        if "@" in mongo_uri:
            display_uri = mongo_uri.replace(
                mongo_uri.split("@")[0].split("//")[1] + "@", "***:***@"
            )

        print(f"Checking MongoDB connection to: {display_uri}")
        print(f"🔍 Actual URI being used (for debugging): {mongo_uri}")

        client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        print("✓ MongoDB connection successful")
        return True
    except ImportError:
        print("✗ pymongo not installed. Installing dependencies...")
        return False
    except Exception as e:
        env_vars = load_env_vars()
        mongo_uri = env_vars.get("MONGO_URI", "mongodb://localhost:27017/")
        display_uri = mongo_uri
        if "@" in mongo_uri:
            display_uri = mongo_uri.replace(
                mongo_uri.split("@")[0].split("//")[1] + "@", "***:***@"
            )

        print(f"✗ MongoDB connection failed: {e}")
        print(f"Attempted to connect to: {display_uri}")
        print("\nTroubleshooting:")
        print("1. Make sure your .env file exists with correct MONGO_URI")
        print("2. For local MongoDB: ensure it's running")
        print("3. For Atlas: check your connection string and network access")
        print("4. Check that your .env file does not have quotes around the URI")
        print("5. Example .env file:")
        print("   MONGO_URI=mongodb://localhost:27017/")
        print("   DATABASE_NAME=romanian_flashcards")
        print("\n💡 Your .env file should look like this:")
        print("MONGO_URI=mongodb+srv://username:password@cluster0.bmj954v.mongodb.net/")
        print("DATABASE_NAME=romanian_flashcards")
        print("\nMake sure there are NO quotes around the URI values!")
        return False


def install_backend_deps():
    """Install Python dependencies"""
    print("\n📦 Installing Python dependencies...")
    backend_path = Path(__file__).parent / "backend"

    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-r",
                str(backend_path / "requirements.txt"),
            ],
            check=True,
            cwd=backend_path,
        )
        print("✓ Python dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install Python dependencies: {e}")
        return False


def install_frontend_deps():
    """Install Node.js dependencies"""
    print("\n📦 Installing Node.js dependencies...")
    frontend_path = Path(__file__).parent / "frontend"

    if not (frontend_path / "node_modules").exists():
        try:
            subprocess.run(["npm", "install"], check=True, cwd=frontend_path)
            print("✓ Node.js dependencies installed")
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install Node.js dependencies: {e}")
            return False
    else:
        print("✓ Node.js dependencies already installed")
        return True


def run_backend():
    """Start the Flask backend"""
    backend_path = Path(__file__).parent / "backend"
    env = os.environ.copy()

    if platform.system() == "Windows":
        return subprocess.Popen(
            [sys.executable, "app.py"],
            cwd=backend_path,
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        return subprocess.Popen(
            [sys.executable, "app.py"], cwd=backend_path, env=env, preexec_fn=os.setsid
        )


def run_frontend():
    """Start the React frontend"""
    frontend_path = Path(__file__).parent / "frontend"
    env = os.environ.copy()
    env["BROWSER"] = "none"  # Prevent auto-opening browser

    if platform.system() == "Windows":
        return subprocess.Popen(
            ["npm", "start"],
            cwd=frontend_path,
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        return subprocess.Popen(
            ["npm", "start"], cwd=frontend_path, env=env, preexec_fn=os.setsid
        )


def cleanup_processes(processes):
    """Clean up running processes"""
    print("\n🛑 Shutting down services...")

    for name, process in processes.items():
        if process and process.poll() is None:
            try:
                if platform.system() == "Windows":
                    process.terminate()
                else:
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                print(f"✓ {name} stopped")
            except Exception as e:
                print(f"✗ Error stopping {name}: {e}")

    # Wait a bit for graceful shutdown
    time.sleep(2)

    # Force kill if needed
    for name, process in processes.items():
        if process and process.poll() is None:
            try:
                if platform.system() == "Windows":
                    process.kill()
                else:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                print(f"✓ {name} force stopped")
            except Exception as e:
                print(f"✗ Error force stopping {name}: {e}")


def main():
    """Main function to run the application"""
    print("🇷🇴 Romanian Flashcards App Launcher")
    print("=" * 40)

    # Check if .env file exists
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        print("⚠️  No .env file found. Creating one from template...")
        template_file = Path(__file__).parent / "env_example.txt"
        if template_file.exists():
            import shutil

            shutil.copy(template_file, env_file)
            print("✓ Created .env file from env_example.txt")
            print("📝 Please edit .env file with your MongoDB configuration")
        else:
            # Create basic .env file
            with open(env_file, "w") as f:
                f.write("MONGO_URI=mongodb://localhost:27017/\n")
                f.write("DATABASE_NAME=romanian_flashcards\n")
            print("✓ Created basic .env file")

    # Check requirements
    if not check_requirements():
        print("\n❌ Requirements check failed. Please install missing dependencies.")
        return 1

    # Install dependencies
    if not install_backend_deps():
        return 1

    if not install_frontend_deps():
        return 1

    # Check MongoDB connection
    if not check_mongodb():
        return 1

    print("\n🚀 Starting services...")

    processes = {}

    try:
        # Start backend
        print("Starting Flask backend...")
        backend_process = run_backend()
        processes["Backend"] = backend_process

        # Wait a bit for backend to start
        time.sleep(3)

        # Start frontend
        print("Starting React frontend...")
        frontend_process = run_frontend()
        processes["Frontend"] = frontend_process

        print("\n✅ Services started successfully!")
        print("\n📍 Access your application at:")
        print("   Frontend: http://localhost:3000")
        print("   Backend API: http://localhost:5000")
        print("   Health Check: http://localhost:5000/api/health")
        print("\n⚠️  Press Ctrl+C to stop all services")

        # Keep the script running
        try:
            while True:
                time.sleep(1)

                # Check if processes are still running
                for name, process in processes.items():
                    if process.poll() is not None:
                        print(f"⚠️  {name} process exited unexpectedly")
                        cleanup_processes(processes)
                        return 1

        except KeyboardInterrupt:
            print("\n\n🛑 Interrupt received, shutting down...")

    except Exception as e:
        print(f"\n❌ Error starting services: {e}")
        return 1

    finally:
        cleanup_processes(processes)

    print("\n👋 Goodbye!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
