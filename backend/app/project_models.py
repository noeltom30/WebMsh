from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


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


class MeshSettings(BaseModel):
    mesh_size_min: float | None = Field(default=None, gt=0)
    mesh_size_max: float | None = Field(default=None, gt=0)
    mesh_order: int = Field(default=1, ge=1, le=2)
    algorithm: int | None = Field(default=None, ge=1, le=12)

    @model_validator(mode="after")
    def validate_size_range(self) -> "MeshSettings":
        if (
            self.mesh_size_min is not None
            and self.mesh_size_max is not None
            and self.mesh_size_min > self.mesh_size_max
        ):
            raise ValueError("mesh_size_min cannot be greater than mesh_size_max")
        return self


class MeshRequestMixin(BaseModel):
    mesh_settings: MeshSettings | None = None


class BoxRequest(MeshRequestMixin):
    width: float = Field(gt=0, description="X dimension")
    depth: float = Field(gt=0, description="Y dimension")
    height: float = Field(gt=0, description="Z dimension")
    origin_x: float = Field(0, description="Box min corner X")
    origin_y: float = Field(0, description="Box min corner Y")
    origin_z: float = Field(0, description="Box min corner Z")


class SphereRequest(MeshRequestMixin):
    radius: float = Field(gt=0, description="Sphere radius")
    center_x: float = Field(0, description="Center X")
    center_y: float = Field(0, description="Center Y")
    center_z: float = Field(0, description="Center Z")


class CylinderRequest(MeshRequestMixin):
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


class BoundingBox(BaseModel):
    min_x: float = 0
    min_y: float = 0
    min_z: float = 0
    max_x: float = 0
    max_y: float = 0
    max_z: float = 0


class Mesh(BaseModel):
    nodes: list[MeshNode]
    triangles: list[list[int]]
    node_count: int = 0
    triangle_count: int = 0
    element_count: int = 0
    bounding_box: BoundingBox = Field(default_factory=BoundingBox)
    mesh_settings: MeshSettings | None = None

    @model_validator(mode="after")
    def populate_metadata(self) -> "Mesh":
        self.node_count = self.node_count or len(self.nodes)
        self.triangle_count = self.triangle_count or len(self.triangles)
        self.element_count = self.element_count or len(self.triangles)
        if self.nodes and self.bounding_box == BoundingBox():
            xs = [node.x for node in self.nodes]
            ys = [node.y for node in self.nodes]
            zs = [node.z for node in self.nodes]
            self.bounding_box = BoundingBox(
                min_x=min(xs),
                min_y=min(ys),
                min_z=min(zs),
                max_x=max(xs),
                max_y=max(ys),
                max_z=max(zs),
            )
        return self


class Point2D(BaseModel):
    x: float
    y: float


class RectangleSketchRequest(MeshRequestMixin):
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    origin_x: float = 0
    origin_y: float = 0
    z: float = 0


class CircleSketchRequest(MeshRequestMixin):
    radius: float = Field(gt=0)
    center_x: float = 0
    center_y: float = 0
    z: float = 0


class PolygonSketchRequest(MeshRequestMixin):
    points: list[Point2D] = Field(min_length=3)
    z: float = 0


class ExtrudeRequest(MeshRequestMixin):
    height: float = Field(gt=0)


class RevolveRequest(MeshRequestMixin):
    angle_degrees: float = Field(default=360, gt=0, le=360)


class GeometryLabelsRequest(BaseModel):
    labels: list[str] = Field(default_factory=list)

    @field_validator("labels")
    @classmethod
    def validate_labels(cls, value: list[str]) -> list[str]:
        allowed = {"wall", "inlet", "outlet", "support", "load", "symmetry"}
        normalized = []
        for label in value:
            item = label.strip().lower()
            if item not in allowed:
                raise ValueError(f"Unsupported label: {label}")
            if item not in normalized:
                normalized.append(item)
        return normalized


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
