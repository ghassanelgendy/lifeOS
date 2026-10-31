#!/usr/bin/env python3
"""
lifeOS - Google Analytics 4 Property & Credentials Linker
Auto-detects credentials JSON, locates or provisions GA4 property for G-E33S655RMQ,
and configures .env for MCP and frontend usage.
"""

import os
import sys
import json
from pathlib import Path

TARGET_MEASUREMENT_ID = "G-E33S655RMQ"
PROJECT_ROOT = Path(__file__).resolve().parent.parent

def find_credentials_file():
    candidates = [
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        PROJECT_ROOT / "service-account.json",
        PROJECT_ROOT / "credentials.json",
        PROJECT_ROOT / "google-credentials.json",
        PROJECT_ROOT / "tools" / "google-analytics-mcp" / "service-account.json",
        PROJECT_ROOT / "tools" / "google-analytics-mcp" / "credentials.json",
    ]
    for c in candidates:
        if c:
            p = Path(c).resolve()
            if p.is_file():
                return p
    return None

def update_env_file(creds_path: Path, project_id: str = None, property_id: str = None):
    env_path = PROJECT_ROOT / ".env"
    env_content = ""
    if env_path.exists():
        env_content = env_path.read_text()

    vars_to_set = {
        "VITE_GA_MEASUREMENT_ID": TARGET_MEASUREMENT_ID,
        "GOOGLE_APPLICATION_CREDENTIALS": str(creds_path),
    }
    if project_id:
        vars_to_set["GOOGLE_CLOUD_PROJECT"] = project_id
    if property_id:
        vars_to_set["GA4_PROPERTY_ID"] = property_id

    lines = env_content.splitlines()
    for k, v in vars_to_set.items():
        found = False
        for i, line in enumerate(lines):
            if line.startswith(f"{k}="):
                lines[i] = f"{k}={v}"
                found = True
                break
        if not found:
            lines.append(f"{k}={v}")

    env_path.write_text("\n".join(lines) + "\n")
    print(f"Updated {env_path.name} with configured credentials and property.")

def main():
    print("=" * 60)
    print("lifeOS: Google Analytics Property & Credentials Manager")
    print(f"Target Measurement ID: {TARGET_MEASUREMENT_ID}")
    print("=" * 60)

    creds_path = find_credentials_file()
    if not creds_path:
        print("\nNo Google credentials JSON file detected yet.")
        print("\nTo link your Google Cloud project / service account:")
        print("  1. Download your Service Account or OAuth key from Google Cloud Console.")
        print(f"  2. Place it in the project root as: {PROJECT_ROOT / 'service-account.json'}")
        print("  3. Run this script again: pnpm analytics:link")
        return 1

    print(f"Found credentials file: {creds_path}")
    project_id = ""
    try:
        data = json.loads(creds_path.read_text())
        project_id = data.get("project_id", "")
        print(f"Detected Google Cloud Project ID: {project_id or '(none)'}")
    except Exception as e:
        print(f"Warning: Could not parse credentials JSON: {e}")

    # Set in environment for SDKs
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds_path)
    if project_id and not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        os.environ["GOOGLE_CLOUD_PROJECT"] = project_id

    # Try connecting with Google Analytics Admin API
    try:
        from google.analytics import admin_v1alpha
        client = admin_v1alpha.AnalyticsAdminServiceClient()

        print("\nQuerying Google Analytics Admin API for accounts and properties...")
        matched_property = None
        matched_stream = None

        accounts = list(client.list_accounts())
        print(f"Found {len(accounts)} Google Analytics account(s).")

        for acc in accounts:
            print(f"  • Account: {acc.display_name} ({acc.name})")
            properties = list(client.list_properties(filter=f"parent:{acc.name}"))
            for prop in properties:
                prop_num = prop.name.replace("properties/", "")
                # Query data streams for this property
                streams = list(client.list_data_streams(parent=prop.name))
                for stream in streams:
                    m_id = getattr(stream.web_stream_data, "measurement_id", "")
                    if m_id.upper() == TARGET_MEASUREMENT_ID.upper():
                        matched_property = prop
                        matched_stream = stream
                        print(f"    --> MATCH FOUND! Property '{prop.display_name}' [ID: {prop_num}] has measurement ID {m_id}")
                        break
                if matched_property:
                    break
            if matched_property:
                break

        if matched_property:
            prop_num = matched_property.name.replace("properties/", "")
            print(f"\nSuccessfully matched property: {matched_property.display_name} (ID: {prop_num})")
            update_env_file(creds_path, project_id, prop_num)
            print("\nSetup complete! You can now run reports via:")
            print("  pnpm analytics:query report " + prop_num)
            print("  pnpm analytics:query realtime " + prop_num)
            return 0
        else:
            print(f"\nMeasurement ID {TARGET_MEASUREMENT_ID} was not found among existing properties.")
            if accounts:
                print("\nWould you like to auto-create a GA4 property and web data stream? (Run with --create)")
                if "--create" in sys.argv:
                    target_account = accounts[0].name
                    print(f"Creating GA4 property under account {target_account}...")
                    new_prop = client.create_property(
                        property=admin_v1alpha.Property(
                            display_name="lifeOS",
                            time_zone="UTC",
                            currency_code="USD",
                        ),
                        parent=target_account,
                    )
                    prop_num = new_prop.name.replace("properties/", "")
                    print(f"Created property: {new_prop.display_name} (ID: {prop_num})")

                    print("Creating Web Data Stream for lifeOS...")
                    stream = client.create_data_stream(
                        parent=new_prop.name,
                        data_stream=admin_v1alpha.DataStream(
                            type_=admin_v1alpha.DataStream.DataStreamType.WEB_DATA_STREAM,
                            display_name="lifeOS Web App",
                            web_stream_data=admin_v1alpha.DataStream.WebStreamData(
                                default_uri="https://life-os-tan.vercel.app"
                            ),
                        ),
                    )
                    created_mid = getattr(stream.web_stream_data, "measurement_id", "")
                    print(f"Web Data Stream created! Measurement ID: {created_mid}")
                    update_env_file(creds_path, project_id, prop_num)
                    return 0
            update_env_file(creds_path, project_id)
            return 0

    except ImportError:
        print("\nNote: google-analytics-admin SDK not found in current python interpreter.")
        print("Using tools/google-analytics-mcp/.venv interpreter...")
        venv_py = PROJECT_ROOT / "tools" / "google-analytics-mcp" / ".venv" / "bin" / "python"
        if venv_py.exists():
            os.execv(str(venv_py), [str(venv_py), __file__] + sys.argv[1:])
    except Exception as e:
        print(f"\nAPI Query Result: {e}")
        update_env_file(creds_path, project_id)
        return 0

if __name__ == "__main__":
    sys.exit(main())
