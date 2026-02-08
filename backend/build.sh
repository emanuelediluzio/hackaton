#!/bin/bash
# Build script for backend deployment
# This installs dependencies from both PyPI and the Emergent extra index
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
