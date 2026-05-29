import os
import json
import re
import shutil
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import send2trash

app = FastAPI(title="MDMan Local Server", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).parent.resolve()
CONFIG_FILE = PROJECT_ROOT / "config.json"

# Load current notes directory from config
def load_notes_dir() -> Path:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                path_str = data.get("notes_dir")
                if path_str:
                    path = Path(path_str).resolve()
                    # Ensure path exists, if not fallback
                    if path.exists() and path.is_dir():
                        return path
        except Exception:
            pass
    
    # Default fallback
    default_dir = PROJECT_ROOT / "markdown_notes"
    default_dir.mkdir(parents=True, exist_ok=True)
    return default_dir

# Save notes directory to config
def save_notes_dir(path: Path):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"notes_dir": str(path.resolve())}, f, ensure_ascii=False, indent=2)

CURRENT_NOTES_DIR = load_notes_dir()

def get_notes_dir() -> Path:
    global CURRENT_NOTES_DIR
    return CURRENT_NOTES_DIR

# Activity log helpers
def get_log_file() -> Path:
    log_dir = get_notes_dir() / ".mdman"
    log_dir.mkdir(parents=True, exist_ok=True)
    # Hide the directory on Windows
    if os.name == 'nt':
        try:
            import ctypes
            ctypes.windll.kernel32.SetFileAttributesW(str(log_dir), 2)  # FILE_ATTRIBUTE_HIDDEN
        except Exception:
            pass
    return log_dir / "activity_log.json"

def log_activity(action: str, details: str):
    log_file = get_log_file()
    logs = []
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            pass
            
    log_entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": action, # CREATE, UPDATE, MOVE, RENAME, DELETE, CONFIG
        "details": details
    }
    logs.insert(0, log_entry)  # Insert at beginning to get chronological descending
    
    # Cap at 500 logs for performance
    logs = logs[:500]
    
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

# Helper to parse YAML Front-matter
def parse_frontmatter(content: str):
    frontmatter = {}
    body = content
    # Look for standard frontmatter block starting and ending with ---
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if match:
        fm_text = match.group(1)
        body = content[match.end():]
        for line in fm_text.split("\n"):
            if ":" in line:
                key, val = line.split(":", 1)
                key = key.strip()
                val = val.strip()
                # Strip wrapping quotes
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                # Check if it's a list like [tag1, tag2]
                if val.startswith('[') and val.endswith(']'):
                    val = [item.strip() for item in val[1:-1].split(",") if item.strip()]
                elif ',' in val:
                    val = [item.strip() for item in val.split(",") if item.strip()]
                elif val.lower() == 'true':
                    val = True
                elif val.lower() == 'false':
                    val = False
                frontmatter[key] = val
    return frontmatter, body

# Helper to format frontmatter back to string
def format_frontmatter(metadata: Dict[str, Any]) -> str:
    if not metadata:
        return ""
    lines = ["---"]
    for k, v in metadata.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---\n")
    return "\n".join(lines)

# Safe relative path resolver
def resolve_path(relative_path_str: str) -> Path:
    notes_dir = get_notes_dir()
    # Remove leading slashes/backslashes
    clean_rel = relative_path_str.lstrip("/\\")
    target = (notes_dir / clean_rel).resolve()
    # Security check: ensure path is within notes_dir
    if not str(target).startswith(str(notes_dir)):
        raise HTTPException(status_code=400, detail="허용되지 않은 파일 접근 경로입니다.")
    return target

# --- API ROUTEMENTS ---

@app.get("/api/config")
def get_config():
    return {
        "notes_dir": str(get_notes_dir())
    }

@app.post("/api/config")
async def update_config(request: Request):
    global CURRENT_NOTES_DIR
    try:
        body = await request.json()
        new_dir_str = body.get("notes_dir")
        if not new_dir_str:
            raise HTTPException(status_code=400, detail="경로가 제공되지 않았습니다.")
            
        new_dir = Path(new_dir_str).resolve()
        if not new_dir.exists() or not new_dir.is_dir():
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "존재하지 않는 디렉토리입니다."}
            )
            
        # Log old path and new path
        old_dir = CURRENT_NOTES_DIR
        CURRENT_NOTES_DIR = new_dir
        save_notes_dir(new_dir)
        
        # Log activity in the new folder
        log_activity("CONFIG", f"작업 폴더가 {old_dir}에서 {new_dir}(으)로 변경되었습니다.")
        
        return {"success": True, "notes_dir": str(new_dir)}
    except HTTPException as he:
        raise he
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"서버 오류: {str(e)}"}
        )

@app.get("/api/tree")
def get_tree():
    notes_dir = get_notes_dir()
    
    def build_tree(current_dir: Path) -> List[Dict[str, Any]]:
        items = []
        try:
            for entry in os.scandir(current_dir):
                # Ignore hidden directories/files (starting with .)
                if entry.name.startswith('.'):
                    continue
                
                rel_path = os.path.relpath(entry.path, notes_dir).replace('\\', '/')
                
                if entry.is_dir():
                    children = build_tree(Path(entry.path))
                    items.append({
                        "name": entry.name,
                        "kind": "directory",
                        "relativePath": rel_path,
                        "children": children
                    })
                elif entry.is_file():
                    # Only include markdown files
                    if entry.name.endswith(".md"):
                        items.append({
                            "name": entry.name,
                            "kind": "file",
                            "relativePath": rel_path
                        })
        except Exception:
            pass
            
        # Sort: directories first, then files alphabetically
        items.sort(key=lambda x: (0 if x["kind"] == "directory" else 1, x["name"].lower()))
        return items

    tree = build_tree(notes_dir)
    return tree

@app.get("/api/file")
def get_file(path: str = Query(...)):
    target = resolve_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
    try:
        with open(target, "r", encoding="utf-8") as f:
            raw_content = f.read()
            
        frontmatter, body = parse_frontmatter(raw_content)
        
        # Fetch file system timestamps (Windows ctime is creation time)
        stat = target.stat()
        created_str = datetime.datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M")
        modified_str = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
        
        return {
            "content": body,
            "frontmatter": frontmatter,
            "raw": raw_content,
            "created": created_str,
            "updated": modified_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일을 읽을 수 없습니다: {str(e)}")

@app.post("/api/file")
async def save_file(request: Request):
    try:
        body = await request.json()
        rel_path = body.get("path")
        content = body.get("content", "")
        frontmatter = body.get("frontmatter", {})
        
        if not rel_path:
            raise HTTPException(status_code=400, detail="파일 경로가 올바르지 않습니다.")
            
        target = resolve_path(rel_path)
        # Ensure parent folders exist
        target.parent.mkdir(parents=True, exist_ok=True)
        
        fm_header = format_frontmatter(frontmatter)
        full_content = fm_header + content
        
        with open(target, "w", encoding="utf-8") as f:
            f.write(full_content)
            
        log_activity("UPDATE", f"파일 '{rel_path}'을(를) 저장했습니다.")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/create")
async def create_node(request: Request):
    try:
        body = await request.json()
        parent_path = body.get("parent_path", "")
        name = body.get("name")
        kind = body.get("kind") # "file" or "directory"
        
        if not name:
            raise HTTPException(status_code=400, detail="이름이 비어 있습니다.")
        if kind not in ["file", "directory"]:
            raise HTTPException(status_code=400, detail="타입이 올바르지 않습니다.")
            
        # Security sanitization for name
        name = "".join(c for c in name if c not in r'\/:*?"<>|').strip()
        if not name:
            raise HTTPException(status_code=400, detail="사용할 수 없는 문자가 들어있습니다.")
            
        if kind == "file" and not name.endswith(".md"):
            name += ".md"
            
        parent_dir = resolve_path(parent_path) if parent_path else get_notes_dir()
        target = parent_dir / name
        
        if target.exists():
            raise HTTPException(status_code=400, detail="동일한 이름의 파일/폴더가 이미 존재합니다.")
            
        rel_path = os.path.relpath(target, get_notes_dir()).replace('\\', '/')
        
        if kind == "directory":
            target.mkdir(parents=True, exist_ok=True)
            log_activity("CREATE", f"폴더 '{rel_path}'을(를) 생성했습니다.")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            # Create a basic file with empty frontmatter
            with open(target, "w", encoding="utf-8") as f:
                f.write(f"---\ntags: []\n---\n# {name[:-3]}\n")
            log_activity("CREATE", f"파일 '{rel_path}'을(를) 생성했습니다.")
            
        return {"success": True, "relativePath": rel_path}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"생성 실패: {str(e)}")

@app.post("/api/rename")
async def rename_node(request: Request):
    try:
        body = await request.json()
        rel_path = body.get("path")
        new_name = body.get("new_name")
        
        if not rel_path or not new_name:
            raise HTTPException(status_code=400, detail="필수 정보가 누락되었습니다.")
            
        new_name = "".join(c for c in new_name if c not in r'\/:*?"<>|').strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="사용할 수 없는 이름입니다.")
            
        target = resolve_path(rel_path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")
            
        if target.is_file() and not new_name.endswith(".md"):
            new_name += ".md"
            
        new_target = target.parent / new_name
        if new_target.exists():
            raise HTTPException(status_code=400, detail="동일한 이름이 이미 존재합니다.")
            
        target.rename(new_target)
        
        new_rel_path = os.path.relpath(new_target, get_notes_dir()).replace('\\', '/')
        log_activity("RENAME", f"이름 변경: '{rel_path}' -> '{new_rel_path}'")
        return {"success": True, "relativePath": new_rel_path}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이름 변경 실패: {str(e)}")

@app.post("/api/move")
async def move_node(request: Request):
    try:
        body = await request.json()
        source_rel = body.get("source")
        dest_rel = body.get("destination")
        
        if not source_rel or not dest_rel:
            raise HTTPException(status_code=400, detail="소스 및 목적지 경로가 필요합니다.")
            
        src_path = resolve_path(source_rel)
        dest_path = resolve_path(dest_rel)
        
        if not src_path.exists():
            raise HTTPException(status_code=404, detail="소스 파일을 찾을 수 없습니다.")
            
        # If moving a file into a directory, and dest_path is a directory, resolve the target file path
        if dest_path.is_dir() and src_path.is_file():
            dest_path = dest_path / src_path.name
            
        if dest_path.exists():
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "목적지에 이미 동일한 이름의 파일/폴더가 존재합니다."}
            )
            
        # Create parent directory if needed
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        shutil.move(str(src_path), str(dest_path))
        
        new_dest_rel = os.path.relpath(dest_path, get_notes_dir()).replace('\\', '/')
        log_activity("MOVE", f"이동 완료: '{source_rel}' -> '{new_dest_rel}'")
        return {"success": True, "relativePath": new_dest_rel}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이동 실패: {str(e)}")

@app.delete("/api/delete")
async def delete_node(path: str = Query(...)):
    try:
        target = resolve_path(path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")
            
        # Send to Windows Recycle Bin / OS Trash
        send2trash.send2trash(str(target))
        
        log_activity("DELETE", f"삭제(휴지통으로 이동): '{path}'")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")

@app.get("/api/logs")
def get_logs():
    log_file = get_log_file()
    if not log_file.exists():
        return []
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

@app.get("/api/search")
def search_notes(q: str = Query(...)):
    if not q:
        return []
        
    notes_dir = get_notes_dir()
    results = []
    
    # Case-insensitive query pattern
    pattern = re.compile(re.escape(q), re.IGNORECASE)
    
    # Recursively scan for markdown files
    for root, dirs, files in os.walk(notes_dir):
        # Skip hidden directories like .mdman or .git
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            if not file.endswith(".md"):
                continue
                
            full_path = Path(root) / file
            rel_path = os.path.relpath(full_path, notes_dir).replace('\\', '/')
            
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        if pattern.search(line):
                            results.append({
                                "path": rel_path,
                                "line": line_num,
                                "lineContent": line.strip()
                            })
                            # Cap results per request for safety
                            if len(results) >= 200:
                                return results
            except Exception:
                pass
                
    return results

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    notes_dir = get_notes_dir()
    assets_dir = notes_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    
    # Create safe filename
    filename = "".join(c for c in file.filename if c not in r'\/:*?"<>|').strip()
    # Add unique prefix if file already exists
    target = assets_dir / filename
    if target.exists():
        stem = target.stem
        suffix = target.suffix
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{stem}_{timestamp}{suffix}"
        target = assets_dir / filename
        
    try:
        with open(target, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        rel_path = os.path.relpath(target, notes_dir).replace('\\', '/')
        log_activity("CREATE", f"이미지 업로드: 'assets/{filename}'")
        return {"success": True, "url": f"/api/assets/{filename}", "relativePath": rel_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 업로드 실패: {str(e)}")

# Mount static asset route dynamically to serve files in assets/
@app.get("/api/assets/{filename}")
def serve_asset(filename: str):
    notes_dir = get_notes_dir()
    target = notes_dir / "assets" / filename
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    return FileResponse(str(target))

# Serve compiled frontend from dist/ if it exists
if (PROJECT_ROOT / "dist").exists():
    app.mount("/", StaticFiles(directory=str(PROJECT_ROOT / "dist"), html=True), name="static")

if __name__ == "__main__":
    print(f"MDMan Local Server starting on http://127.0.0.1:8000")
    print(f"Targeting notes folder: {CURRENT_NOTES_DIR}")
    uvicorn.run("mdman_server:app", host="127.0.0.1", port=8000, reload=True)
