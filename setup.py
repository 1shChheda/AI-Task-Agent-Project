from setuptools import setup, find_packages

setup(
    name="ai-task-agent",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "click",
        "python-dotenv",
        "colorama",
        "pyyaml",
        "openai",
        "requests",
    ],
    entry_points={
        "console_scripts": [
            "ai-task=cli.main:cli",
        ],
    },
)