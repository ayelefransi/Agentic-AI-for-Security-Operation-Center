import asyncio
import os
import sys

# Setup django to allow imports? No, the workflow just uses settings which uses pydantic.
from graph.workflow import SOCWorkflow

async def main():
    try:
        wf = SOCWorkflow()
        print("Successfully created workflow.")
        result = await wf.run("Admin user logged in from 192.168.1.50 to 10.0.0.5 but failed 5 times first. This looks like a brute force attack.")
        print(result)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
