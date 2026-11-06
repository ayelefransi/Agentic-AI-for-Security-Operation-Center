"""
Test script for the new supervisor-controlled workflow (V2).

Run with: python test_workflow_v2.py
"""

import asyncio
import json
import logging
import sys
import os

# Ensure backend directory is in the python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graph.workflow_v2 import SOCWorkflowV2

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Test cases covering different alert types
TEST_ALERTS = [
    {
        "name": "Simple Port Scan",
        "alert": "Port scan detected from 45.33.32.156 targeting internal server 10.0.0.5. "
                 "Multiple ports (22, 80, 443, 3306, 8080) scanned within 30 seconds."
    },
    {
        "name": "Brute Force Attack",
        "alert": "Multiple failed login attempts detected. User 'admin' failed authentication "
                 "15 times from IP 103.232.215.140 to server 192.168.1.50 within 2 minutes. "
                 "Last attempt successful."
    },
    {
        "name": "Malware Detection",
        "alert": "Suspicious file detected: C:\\Users\\jdoe\\Downloads\\invoice.exe "
                 "SHA256: 275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f "
                 "File attempting to connect to domain: malicious-c2-server.xyz"
    },
    {
        "name": "Potential Ransomware",
        "alert": "CRITICAL: Mass file encryption detected on host DESKTOP-ABC123. "
                 "Process: cryptlocker.exe (PID 4582) encrypting files in C:\\Users\\. "
                 "Ransom note detected: YOUR_FILES_ARE_ENCRYPTED.txt"
    },
    {
        "name": "Suspicious PowerShell",
        "alert": "PowerShell execution detected with encoded command: "
                 "powershell.exe -encodedCommand JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0AA== "
                 "Parent process: winword.exe. Outbound connection to 185.220.101.32:443"
    }
]


async def test_workflow(workflow: SOCWorkflowV2, alert_data: dict):
    """Test a single alert through the workflow."""
    logger.info(f"\n{'='*80}")
    logger.info(f"Testing: {alert_data['name']}")
    logger.info(f"{'='*80}\n")
    
    try:
        result = await workflow.run(alert_data['alert'])
        
        # Print key results
        logger.info(f"\n{'='*80}")
        logger.info(f"Results for: {alert_data['name']}")
        logger.info(f"{'='*80}")
        logger.info(f"Verdict: {result.get('decision', 'N/A')}")
        logger.info(f"Severity: {result.get('triage', {}).get('severity', 'N/A')} "
                   f"(Score: {result.get('triage', {}).get('score', 0)}/100)")
        logger.info(f"Investigation Plan: {result.get('investigation_plan_summary', 'N/A')}")
        logger.info(f"Iterations: {result.get('supervisor_iteration', 1)}")
        
        # Show agent execution
        logger.info(f"\nAgent Execution Trace:")
        for step in result.get('agent_trace', []):
            status_icon = {
                'done': '✅',
                'running': '⏳',
                'error': '❌',
                'skipped': '⏭️'
            }.get(step.get('status', 'unknown'), '❓')
            logger.info(
                f"  {status_icon} {step.get('agent_name', 'unknown')}: "
                f"{step.get('status', 'unknown')} ({step.get('duration_ms', 0):.0f}ms)"
            )
        
        # Show IOC analysis
        if result.get('enrichments'):
            logger.info(f"\nIOC Analysis:")
            for enr in result['enrichments'][:5]:  # First 5
                logger.info(
                    f"  - {enr['ioc']['value']}: {enr['final_verdict']} "
                    f"(confidence: {enr['final_confidence']:.0%})"
                )
        
        # Show MITRE mappings
        if result.get('mitre_mappings'):
            logger.info(f"\nMITRE ATT&CK Techniques:")
            for mapping in result['mitre_mappings'][:5]:  # First 5
                logger.info(
                    f"  - {mapping['technique_id']} ({mapping['technique_name']}) "
                    f"[{mapping['tactic']}]"
                )
        
        # Show recommended actions
        if result.get('recommended_actions'):
            logger.info(f"\nRecommended Actions:")
            for action in result['recommended_actions']:
                logger.info(f"  - {action}")
        
        logger.info(f"\n{'='*80}\n")
        
        return result
        
    except Exception as e:
        logger.error(f"Test failed for '{alert_data['name']}': {e}", exc_info=True)
        return None


async def main():
    """Run all test cases."""
    logger.info("Initializing SOC Workflow V2...")
    
    try:
        workflow = SOCWorkflowV2()
        logger.info("Workflow initialized successfully\n")
    except Exception as e:
        logger.error(f"Failed to initialize workflow: {e}", exc_info=True)
        return
    
    # Run all test cases
    results = []
    for test_case in TEST_ALERTS:
        result = await test_workflow(workflow, test_case)
        results.append({
            "name": test_case["name"],
            "success": result is not None,
            "verdict": result.get('decision') if result else None,
            "severity": result.get('triage', {}).get('severity') if result else None
        })
        
        # Small delay between tests
        await asyncio.sleep(1)
    
    # Summary
    logger.info(f"\n{'='*80}")
    logger.info("TEST SUMMARY")
    logger.info(f"{'='*80}")
    
    successful = sum(1 for r in results if r['success'])
    logger.info(f"Total Tests: {len(results)}")
    logger.info(f"Successful: {successful}")
    logger.info(f"Failed: {len(results) - successful}")
    
    logger.info(f"\nDetailed Results:")
    for r in results:
        status = "✅ PASS" if r['success'] else "❌ FAIL"
        logger.info(f"  {status} - {r['name']}: {r['verdict']} ({r['severity']})")
    
    logger.info(f"\n{'='*80}\n")


if __name__ == "__main__":
    asyncio.run(main())
