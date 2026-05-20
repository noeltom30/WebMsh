import json
import os
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError

try:
    from .auth import AuthUser, get_current_user
    from .db import connect_db
    from .mesh_service import (
        build_box_mesh,
        build_circle_sketch_mesh,
        build_cylinder_mesh,
        build_extruded_sketch_mesh,
        build_polygon_sketch_mesh,
        build_rectangle_sketch_mesh,
        build_revolved_sketch_mesh,
        build_sphere_mesh,
        gmsh_available,
    )
    from .project_models import GeometryLabelsRequest, Mesh, MeshSettings, Point2D
    from .project_service import (
        create_geometry,
        delete_geometry,
        get_geometry_record,
        list_project_geometries,
        update_geometry_labels,
        update_geometry_mesh,
    )
except ImportError:  # pragma: no cover - for local imports
    from auth import AuthUser, get_current_user
    from db import connect_db
    from mesh_service import (
        build_box_mesh,
        build_circle_sketch_mesh,
        build_cylinder_mesh,
        build_extruded_sketch_mesh,
        build_polygon_sketch_mesh,
        build_rectangle_sketch_mesh,
        build_revolved_sketch_mesh,
        build_sphere_mesh,
        gmsh_available,
    )
    from project_models import GeometryLabelsRequest, Mesh, MeshSettings, Point2D
    from project_service import (
        create_geometry,
        delete_geometry,
        get_geometry_record,
        list_project_geometries,
        update_geometry_labels,
        update_geometry_mesh,
    )


router = APIRouter(tags=["assistant"])

LLM_PROVIDER = os.getenv("WEBMSH_LLM_PROVIDER", "openai").strip().lower()
DEFAULT_API_BASE = (
    "https://generativelanguage.googleapis.com/v1beta" if LLM_PROVIDER == "gemini" else "https://api.openai.com/v1"
)
DEFAULT_MODEL = "gemini-1.5-flash-latest" if LLM_PROVIDER == "gemini" else "gpt-4o-mini"

LLM_API_BASE = os.getenv("WEBMSH_LLM_API_BASE", DEFAULT_API_BASE)
LLM_API_KEY = os.getenv("WEBMSH_LLM_API_KEY")
LLM_MODEL = os.getenv("WEBMSH_LLM_MODEL", DEFAULT_MODEL)
LLM_TIMEOUT = float(os.getenv("WEBMSH_LLM_TIMEOUT", "45"))

GEMINI_PREFERRED_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
]

SYSTEM_PROMPT = """You are the WebMsh AI assistant. You can change the mesh workspace only by returning JSON.

Return a JSON object with this exact shape:
{
  "message": "A short explanation for the user.",
  "actions": [
    { "type": "create_box", "params": { ... } }
  ]
}

Allowed action types and params:
- create_box: width, depth, height, origin_x, origin_y, origin_z, mesh_settings (optional)
- create_sphere: radius, center_x, center_y, center_z, mesh_settings (optional)
- create_cylinder: radius, height, base_x, base_y, base_z, mesh_settings (optional)
- create_sketch_rectangle: width, height, origin_x, origin_y, z, mesh_settings (optional)
- create_sketch_circle: radius, center_x, center_y, z, mesh_settings (optional)
- create_sketch_polygon: points (array of {x,y}), z, mesh_settings (optional)
- extrude: source_geometry_id, height, mesh_settings (optional)
- revolve: source_geometry_id, angle_degrees, mesh_settings (optional)
- delete_geometry: geometry_id
- delete_all_geometry: (no params)
- update_labels: geometry_id, labels (allowed: wall, inlet, outlet, support, load, symmetry)
- remesh_geometry: geometry_id, mesh_settings

Mesh settings fields:
- mesh_size_min (number)
- mesh_size_max (number)
- mesh_order (1 or 2)
- algorithm (1, 5, 6, or 8)

Rules:
- Only use geometry IDs that exist in the workspace snapshot.
- If a request is ambiguous or missing required inputs, respond with a helpful question and no actions.
- Output ONLY valid JSON with no markdown or extra text.
"""


class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class AssistantRequest(BaseModel):
    project_id: int = Field(gt=0)
    prompt: str = Field(min_length=1)
    history: list[AssistantMessage] = Field(default_factory=list)


class AssistantAction(BaseModel):
    type: str
    params: dict[str, Any] = Field(default_factory=dict)


class AssistantPlan(BaseModel):
    message: str = Field(min_length=1)
    actions: list[AssistantAction] = Field(default_factory=list)


class AssistantActionResult(BaseModel):
    type: str
    status: Literal["ok", "error"]
    detail: str
    geometry_id: int | None = None


class AssistantResponse(BaseModel):
    message: str
    actions: list[AssistantActionResult] = Field(default_factory=list)


class BoxActionParams(BaseModel):
    width: float
    depth: float
    height: float
    origin_x: float = 0
    origin_y: float = 0
    origin_z: float = 0
    mesh_settings: MeshSettings | None = None


class SphereActionParams(BaseModel):
    radius: float
    center_x: float = 0
    center_y: float = 0
    center_z: float = 0
    mesh_settings: MeshSettings | None = None


class CylinderActionParams(BaseModel):
    radius: float
    height: float
    base_x: float = 0
    base_y: float = 0
    base_z: float = 0
    mesh_settings: MeshSettings | None = None


class SketchRectActionParams(BaseModel):
    width: float
    height: float
    origin_x: float = 0
    origin_y: float = 0
    z: float = 0
    mesh_settings: MeshSettings | None = None


class SketchCircleActionParams(BaseModel):
    radius: float
    center_x: float = 0
    center_y: float = 0
    z: float = 0
    mesh_settings: MeshSettings | None = None


class SketchPolygonActionParams(BaseModel):
    points: list[Point2D]
    z: float = 0
    mesh_settings: MeshSettings | None = None


class ExtrudeActionParams(BaseModel):
    source_geometry_id: int
    height: float
    mesh_settings: MeshSettings | None = None


class RevolveActionParams(BaseModel):
    source_geometry_id: int
    angle_degrees: float = 360
    mesh_settings: MeshSettings | None = None


class DeleteActionParams(BaseModel):
    geometry_id: int


class UpdateLabelsActionParams(BaseModel):
    geometry_id: int
    labels: list[str]


class RemeshActionParams(BaseModel):
    geometry_id: int
    mesh_settings: MeshSettings


def _require_llm() -> None:
    if not LLM_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="LLM is not configured. Set WEBMSH_LLM_API_KEY to enable assistant requests.",
        )


def _workspace_snapshot(project_id: int, geometries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "project_id": project_id,
        "geometries": geometries,
    }


def _summarize_geometry(record) -> dict[str, Any]:
    mesh = record.mesh
    return {
        "id": record.id,
        "type": record.type,
        "params": record.params,
        "mesh": {
            "node_count": mesh.node_count if mesh else 0,
            "triangle_count": mesh.triangle_count if mesh else 0,
            "bounding_box": mesh.bounding_box.model_dump() if mesh else None,
        },
    }


def _parse_llm_json(content: str) -> AssistantPlan:
    payload = content.strip()
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        start = payload.find("{")
        end = payload.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise HTTPException(status_code=502, detail="Assistant response was not valid JSON")
        try:
            data = json.loads(payload[start : end + 1])
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail="Assistant response could not be parsed") from exc
    try:
        return AssistantPlan.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="Assistant response schema was invalid") from exc


def _extract_upstream_message(response: httpx.Response) -> str | None:
    try:
        data = response.json()
    except ValueError:
        data = None
    if isinstance(data, dict):
        error = data.get("error") or {}
        if isinstance(error, dict):
            message = error.get("message")
            if message:
                return str(message)
        message = data.get("message")
        if message:
            return str(message)
    text = response.text.strip()
    return text[:300] if text else None


def _gemini_model_path(model: str) -> str:
    cleaned = model.strip()
    if cleaned.startswith("models/"):
        return cleaned
    return f"models/{cleaned}"


def _gemini_base_candidates(base: str) -> list[str]:
    trimmed = base.rstrip("/")
    if trimmed.endswith("/v1beta"):
        return [trimmed, trimmed[: -len("/v1beta")] + "/v1"]
    if trimmed.endswith("/v1"):
        return [trimmed, trimmed[: -len("/v1")] + "/v1beta"]
    return [trimmed]


def _normalize_gemini_model_name(name: str) -> str:
    return name.replace("models/", "").strip()


def _raise_llm_error(response: httpx.Response) -> None:
    upstream_message = _extract_upstream_message(response)
    if response.status_code in {401, 403}:
        detail = "LLM authentication failed. Check WEBMSH_LLM_API_KEY."
    elif response.status_code == 404:
        detail = "LLM model not found. Check WEBMSH_LLM_MODEL."
    elif response.status_code == 429:
        detail = "LLM rate limit exceeded. Check billing/quota or wait and retry."
    else:
        detail = "LLM request failed."
    if upstream_message:
        detail = f"{detail} ({upstream_message})"
    status = response.status_code if response.status_code in {401, 403, 404, 429} else 502
    raise HTTPException(status_code=status, detail=detail)


def _gemini_payload(messages: list[dict[str, str]]) -> dict[str, Any]:
    system_parts: list[str] = []
    contents: list[dict[str, Any]] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            if content:
                system_parts.append(content)
            continue
        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})

    system_text = "\n\n".join(system_parts).strip()
    if system_text:
        prefixed = f"System instructions:\n{system_text}"
        if contents and contents[0]["role"] == "user":
            contents[0]["parts"][0]["text"] = f"{prefixed}\n\n{contents[0]['parts'][0]['text']}"
        else:
            contents.insert(0, {"role": "user", "parts": [{"text": prefixed}]})

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": 0.2},
    }
    return payload


async def _gemini_request(
    client: httpx.AsyncClient,
    base: str,
    model: str,
    messages: list[dict[str, str]],
) -> httpx.Response:
    url = f"{base.rstrip('/')}/{_gemini_model_path(model)}:generateContent"
    payload = _gemini_payload(messages)
    headers = {"x-goog-api-key": LLM_API_KEY}
    return await client.post(url, json=payload, headers=headers)


async def _gemini_list_models(client: httpx.AsyncClient, base: str) -> list[str]:
    url = f"{base.rstrip('/')}/models"
    headers = {"x-goog-api-key": LLM_API_KEY}
    response = await client.get(url, headers=headers)
    if response.status_code >= 400:
        return []
    try:
        data = response.json()
    except ValueError:
        return []
    models = data.get("models") or []
    filtered = []
    for model in models:
        name = model.get("name")
        if not name:
            continue
        methods = model.get("supportedGenerationMethods") or []
        if "generateContent" in methods:
            filtered.append(name)
    return filtered


def _gemini_pick_model(models: list[str]) -> str | None:
    if not models:
        return None
    normalized = {_normalize_gemini_model_name(name): name for name in models}
    for pref in GEMINI_PREFERRED_MODELS:
        for norm, actual in normalized.items():
            if norm == pref or norm.startswith(pref):
                return actual
    return models[0]


async def _call_llm(messages: list[dict[str, str]]) -> AssistantPlan:
    _require_llm()
    if LLM_PROVIDER == "gemini":
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            last_response: httpx.Response | None = None
            use_auto = LLM_MODEL.strip().lower() == "auto"
            for base in _gemini_base_candidates(LLM_API_BASE):
                model_to_use = LLM_MODEL
                if use_auto:
                    listed = await _gemini_list_models(client, base)
                    model_to_use = _gemini_pick_model(listed)
                    if not model_to_use:
                        continue
                response = await _gemini_request(client, base, model_to_use, messages)
                last_response = response
                if response.status_code < 400:
                    break
                if response.status_code == 404 and not use_auto:
                    listed = await _gemini_list_models(client, base)
                    fallback_model = _gemini_pick_model(listed)
                    if fallback_model and _normalize_gemini_model_name(fallback_model) != _normalize_gemini_model_name(LLM_MODEL):
                        response = await _gemini_request(client, base, fallback_model, messages)
                        last_response = response
                        if response.status_code < 400:
                            break
            if last_response is None:
                raise HTTPException(
                    status_code=502,
                    detail="No Gemini models with generateContent are available for this API key.",
                )
            if last_response.status_code >= 400:
                _raise_llm_error(last_response)
        data = response.json()
        candidates = data.get("candidates") or []
        content = None
        if candidates:
            parts = (candidates[0].get("content") or {}).get("parts") or []
            if parts:
                content = parts[0].get("text")
        if not content:
            raise HTTPException(status_code=502, detail="Assistant response was empty.")
        return _parse_llm_json(content)

    url = f"{LLM_API_BASE.rstrip('/')}/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "messages": messages,
    }
    headers = {"Authorization": f"Bearer {LLM_API_KEY}"}
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
    if response.status_code >= 400:
        _raise_llm_error(response)
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise HTTPException(status_code=502, detail="Assistant response was empty.")
    return _parse_llm_json(content)


def _mesh_settings_payload(mesh_settings: MeshSettings | None) -> dict[str, Any] | None:
    if mesh_settings is None:
        return None
    return mesh_settings.model_dump(mode="json")


def _ensure_gmsh() -> None:
    if not gmsh_available():
        raise HTTPException(status_code=503, detail="gmsh is not available on the server")


def _remesh_from_record(record, mesh_settings: MeshSettings | None) -> Mesh:
    _ensure_gmsh()
    params = record.params or {}
    if record.type == "box":
        return build_box_mesh(
            float(params.get("width", 1)),
            float(params.get("depth", 1)),
            float(params.get("height", 1)),
            float(params.get("origin_x", 0)),
            float(params.get("origin_y", 0)),
            float(params.get("origin_z", 0)),
            mesh_settings,
        )
    if record.type == "sphere":
        return build_sphere_mesh(
            float(params.get("radius", 1)),
            float(params.get("center_x", 0)),
            float(params.get("center_y", 0)),
            float(params.get("center_z", 0)),
            mesh_settings,
        )
    if record.type == "cylinder":
        return build_cylinder_mesh(
            float(params.get("radius", 1)),
            float(params.get("height", 1)),
            float(params.get("base_x", 0)),
            float(params.get("base_y", 0)),
            float(params.get("base_z", 0)),
            mesh_settings,
        )
    if record.type == "sketch_rectangle":
        return build_rectangle_sketch_mesh(
            float(params.get("width", 1)),
            float(params.get("height", 1)),
            float(params.get("origin_x", 0)),
            float(params.get("origin_y", 0)),
            float(params.get("z", 0)),
            mesh_settings,
        )
    if record.type == "sketch_circle":
        return build_circle_sketch_mesh(
            float(params.get("radius", 1)),
            float(params.get("center_x", 0)),
            float(params.get("center_y", 0)),
            float(params.get("z", 0)),
            mesh_settings,
        )
    if record.type == "sketch_polygon":
        points = [Point2D.model_validate(point) for point in params.get("points", [])]
        if len(points) < 3:
            raise HTTPException(status_code=400, detail="Polygon sketch requires at least 3 points")
        return build_polygon_sketch_mesh(points, float(params.get("z", 0)), mesh_settings)
    if record.type in {"extrude", "revolve"}:
        raise HTTPException(status_code=400, detail=f"Remesh not supported for geometry type '{record.type}'.")
    raise HTTPException(status_code=400, detail=f"Remesh not supported for geometry type '{record.type}'.")


@router.post("/assistant", response_model=AssistantResponse)
async def assistant_chat(body: AssistantRequest, current_user: AuthUser = Depends(get_current_user)):
    with connect_db() as conn:
        geometries = list_project_geometries(conn, current_user.id, body.project_id)

    snapshot = _workspace_snapshot(
        body.project_id,
        [_summarize_geometry(record) for record in geometries],
    )
    prompt = f"Workspace snapshot (JSON): {json.dumps(snapshot)}\nUser request: {body.prompt}"

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in body.history[-8:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": prompt})

    plan = await _call_llm(messages)

    if not plan.actions:
        return AssistantResponse(message=plan.message, actions=[])

    results: list[AssistantActionResult] = []

    with connect_db() as conn:
        for action in plan.actions:
            action_type = action.type.strip().lower()
            params = action.params or {}
            try:
                if action_type == "create_box":
                    _ensure_gmsh()
                    data = BoxActionParams.model_validate(params)
                    mesh = build_box_mesh(
                        data.width,
                        data.depth,
                        data.height,
                        data.origin_x,
                        data.origin_y,
                        data.origin_z,
                        data.mesh_settings,
                    )
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    record = create_geometry(conn, current_user.id, body.project_id, "box", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created box geometry #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "create_sphere":
                    _ensure_gmsh()
                    data = SphereActionParams.model_validate(params)
                    mesh = build_sphere_mesh(
                        data.radius,
                        data.center_x,
                        data.center_y,
                        data.center_z,
                        data.mesh_settings,
                    )
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    record = create_geometry(conn, current_user.id, body.project_id, "sphere", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created sphere geometry #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "create_cylinder":
                    _ensure_gmsh()
                    data = CylinderActionParams.model_validate(params)
                    mesh = build_cylinder_mesh(
                        data.radius,
                        data.height,
                        data.base_x,
                        data.base_y,
                        data.base_z,
                        data.mesh_settings,
                    )
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    record = create_geometry(conn, current_user.id, body.project_id, "cylinder", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created cylinder geometry #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "create_sketch_rectangle":
                    _ensure_gmsh()
                    data = SketchRectActionParams.model_validate(params)
                    mesh = build_rectangle_sketch_mesh(
                        data.width,
                        data.height,
                        data.origin_x,
                        data.origin_y,
                        data.z,
                        data.mesh_settings,
                    )
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    record = create_geometry(conn, current_user.id, body.project_id, "sketch_rectangle", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created rectangle sketch #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "create_sketch_circle":
                    _ensure_gmsh()
                    data = SketchCircleActionParams.model_validate(params)
                    mesh = build_circle_sketch_mesh(
                        data.radius,
                        data.center_x,
                        data.center_y,
                        data.z,
                        data.mesh_settings,
                    )
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    record = create_geometry(conn, current_user.id, body.project_id, "sketch_circle", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created circle sketch #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "create_sketch_polygon":
                    _ensure_gmsh()
                    data = SketchPolygonActionParams.model_validate(params)
                    mesh = build_polygon_sketch_mesh(data.points, data.z, data.mesh_settings)
                    payload = data.model_dump()
                    payload["mesh_settings"] = _mesh_settings_payload(data.mesh_settings)
                    payload["points"] = [point.model_dump() for point in data.points]
                    record = create_geometry(conn, current_user.id, body.project_id, "sketch_polygon", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Created polygon sketch #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "extrude":
                    _ensure_gmsh()
                    data = ExtrudeActionParams.model_validate(params)
                    source = get_geometry_record(conn, current_user.id, body.project_id, data.source_geometry_id)
                    if not source.type.startswith("sketch_"):
                        raise HTTPException(status_code=400, detail="Extrude requires a sketch geometry")
                    mesh = build_extruded_sketch_mesh(
                        source.type,
                        source.params,
                        data.height,
                        data.mesh_settings,
                    )
                    payload = {
                        "source_geometry_id": data.source_geometry_id,
                        "source_type": source.type,
                        "height": data.height,
                        "mesh_settings": _mesh_settings_payload(data.mesh_settings),
                    }
                    record = create_geometry(conn, current_user.id, body.project_id, "extrude", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Extruded sketch #{data.source_geometry_id} → geometry #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "revolve":
                    _ensure_gmsh()
                    data = RevolveActionParams.model_validate(params)
                    source = get_geometry_record(conn, current_user.id, body.project_id, data.source_geometry_id)
                    if not source.type.startswith("sketch_"):
                        raise HTTPException(status_code=400, detail="Revolve requires a sketch geometry")
                    mesh = build_revolved_sketch_mesh(
                        source.type,
                        source.params,
                        data.angle_degrees,
                        data.mesh_settings,
                    )
                    payload = {
                        "source_geometry_id": data.source_geometry_id,
                        "source_type": source.type,
                        "angle_degrees": data.angle_degrees,
                        "mesh_settings": _mesh_settings_payload(data.mesh_settings),
                    }
                    record = create_geometry(conn, current_user.id, body.project_id, "revolve", payload, mesh)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Revolved sketch #{data.source_geometry_id} → geometry #{record.id}",
                            geometry_id=record.id,
                        )
                    )
                    continue

                if action_type == "delete_geometry":
                    data = DeleteActionParams.model_validate(params)
                    delete_geometry(conn, current_user.id, body.project_id, data.geometry_id)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Deleted geometry #{data.geometry_id}",
                            geometry_id=data.geometry_id,
                        )
                    )
                    continue

                if action_type == "delete_all_geometry":
                    records = list_project_geometries(conn, current_user.id, body.project_id)
                    for record in records:
                        delete_geometry(conn, current_user.id, body.project_id, record.id)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Deleted {len(records)} geometries",
                        )
                    )
                    continue

                if action_type == "update_labels":
                    data = UpdateLabelsActionParams.model_validate(params)
                    GeometryLabelsRequest(labels=data.labels)
                    update_geometry_labels(conn, current_user.id, body.project_id, data.geometry_id, data.labels)
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Updated labels on geometry #{data.geometry_id}",
                            geometry_id=data.geometry_id,
                        )
                    )
                    continue

                if action_type == "remesh_geometry":
                    data = RemeshActionParams.model_validate(params)
                    record = get_geometry_record(conn, current_user.id, body.project_id, data.geometry_id)
                    _ensure_gmsh()
                    if record.type == "extrude":
                        source_id = int(record.params.get("source_geometry_id", 0))
                        if source_id <= 0:
                            raise HTTPException(status_code=400, detail="Extrude source sketch is missing")
                        source = get_geometry_record(conn, current_user.id, body.project_id, source_id)
                        if not source.type.startswith("sketch_"):
                            raise HTTPException(status_code=400, detail="Extrude requires a sketch geometry")
                        height = float(record.params.get("height", 0))
                        if height <= 0:
                            raise HTTPException(status_code=400, detail="Extrude height is missing")
                        mesh = build_extruded_sketch_mesh(
                            source.type,
                            source.params,
                            height,
                            data.mesh_settings,
                        )
                    elif record.type == "revolve":
                        source_id = int(record.params.get("source_geometry_id", 0))
                        if source_id <= 0:
                            raise HTTPException(status_code=400, detail="Revolve source sketch is missing")
                        source = get_geometry_record(conn, current_user.id, body.project_id, source_id)
                        if not source.type.startswith("sketch_"):
                            raise HTTPException(status_code=400, detail="Revolve requires a sketch geometry")
                        angle = float(record.params.get("angle_degrees", 360))
                        mesh = build_revolved_sketch_mesh(
                            source.type,
                            source.params,
                            angle,
                            data.mesh_settings,
                        )
                    else:
                        mesh = _remesh_from_record(record, data.mesh_settings)
                    updated = update_geometry_mesh(
                        conn,
                        current_user.id,
                        body.project_id,
                        data.geometry_id,
                        mesh,
                        mesh_settings=data.mesh_settings,
                    )
                    results.append(
                        AssistantActionResult(
                            type=action_type,
                            status="ok",
                            detail=f"Remeshed geometry #{updated.id}",
                            geometry_id=updated.id,
                        )
                    )
                    continue

                raise HTTPException(status_code=400, detail=f"Unknown assistant action '{action_type}'")
            except HTTPException:
                raise
            except ValidationError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Assistant action failed: {exc}") from exc

    return AssistantResponse(message=plan.message, actions=results)
