from typing import Any

from pydantic import BaseModel, Field, field_validator


class ProjectNamePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Project name cannot be blank")
        return normalized


class ProjectCreateRequest(ProjectNamePayload):
    pass


class ProjectRenameRequest(ProjectNamePayload):
    pass


class BoxRequest(BaseModel):
    width: float = Field(gt=0, description="X dimension")
    depth: float = Field(gt=0, description="Y dimension")
    height: float = Field(gt=0, description="Z dimension")
    origin_x: float = Field(0, description="Box min corner X")
    origin_y: float = Field(0, description="Box min corner Y")
    origin_z: float = Field(0, description="Box min corner Z")


class SphereRequest(BaseModel):
    radius: float = Field(gt=0, description="Sphere radius")
    center_x: float = Field(0, description="Center X")
    center_y: float = Field(0, description="Center Y")
    center_z: float = Field(0, description="Center Z")


class CylinderRequest(BaseModel):
    radius: float = Field(gt=0, description="Cylinder radius")
    height: float = Field(gt=0, description="Cylinder height")
    base_x: float = Field(0, description="Base center X")
    base_y: float = Field(0, description="Base center Y")
    base_z: float = Field(0, description="Base center Z")


class MeshNode(BaseModel):
    id: int
    x: float
    y: float
    z: float


class Mesh(BaseModel):
    nodes: list[MeshNode]
    triangles: list[list[int]]


class GeometryRecord(BaseModel):
    id: int
    type: str
    params: dict[str, Any]
    mesh: Mesh | None = None


class ProjectSummary(BaseModel):
    id: int
    name: str
    created_at: str
    updated_at: str
    last_opened_at: str | None = None
    geometry_count: int = 0


class ProjectDetail(ProjectSummary):
    geometries: list[GeometryRecord]
