import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/api"))
from app.main import app
path = Path(__file__).resolve().parents[1] / "packages/contracts/openapi.json"
content = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
if "--check" in sys.argv:
    assert path.read_text() == content, "OpenAPI drift: run scripts/export_openapi.py"
else:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
