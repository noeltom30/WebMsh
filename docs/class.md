classDiagram
  %% Frontend
  class App {
    +state auth, projects, geoms, meshSettings
    +loadStatus()
    +openProject(id)
    +handleGeometryCrud()
    +handlePhysicalGroups()
    +handleMeshOps()
    +handleExport()
    +undoRedo()
  }

  class ApiClient {
    +loginRedirect()
    +refreshTokens()
    +health()
    +info()
    +listProjects()
    +loadProject(id)
    +saveProject(payload)
    +listGeometry()
    +createBox(body)
    +createSphere(body)
    +createCylinder(body)
    +uploadCAD(file)
    +deleteGeometry(id)
    +createPhysicalGroup(body)
    +updatePhysicalGroup(id, body)
    +deletePhysicalGroup(id)
    +generateMesh(body)
    +exportMesh(fmt)
  }

  class ProjectState {
    +string id
    +string name
    +Geometry[] geometries
    +PhysicalGroup[] groups
    +MeshSettings meshSettings
    +ViewerState viewer
  }

  class PhysicalGroup {
    +int id
    +string name
    +int dimension
    +int[] entityTags
    +string color
  }

  class MeshSettings {
    +float minSize
    +float maxSize
    +string algo2d
    +string algo3d
    +bool recombine2d
    +bool secondOrder
  }

  class ViewerState {
    +cameraPose
    +theme
    +clippingPlane
  }

  class Geometry {
    +int id
    +string type
    +dict params
    +Mesh mesh
  }

  class Mesh {
    +MeshNode[] nodes
    +int[] triangles
  }

  class MeshNode {
    +int id
    +float x
    +float y
    +float z
  }

  %% Backend models
  class BoxRequest {
    +float width
    +float depth
    +float height
    +float origin_x
    +float origin_y
    +float origin_z
  }

  class SphereRequest {
    +float radius
    +float center_x
    +float center_y
    +float center_z
  }

  class CylinderRequest {
    +float radius
    +float height
    +float base_x
    +float base_y
    +float base_z
  }

  class PhysicalGroupRequest {
    +string name
    +int dimension
    +int[] entityTags
  }

  class MeshRequest {
    +int dimension
    +MeshSettings settings
  }

  class ExportRequest {
    +string format
  }

  class AuthSession {
    +string userId
    +string accessToken
    +string refreshToken
    +datetime expiresAt
  }

  class ProjectRecord {
    +string id
    +string userId
    +string name
    +datetime updatedAt
    +path brepPath
    +path metaPath
  }

  class GmshService {
    <<utility>>
    +buildBoxMesh(...)
    +buildSphereMesh(...)
    +buildCylinderMesh(...)
    +buildMeshFromCad(path)
    +generateMesh(settings)
    +extractSurfaceMesh()
  }

  class FastAPIApp {
    <<FastAPI>>
    +getHealth()
    +getInfo()
    +listProjects()
    +getProject(id)
    +saveProject(id)
    +listGeometry()
    +createBox()
    +createSphere()
    +createCylinder()
    +uploadCad()
    +deleteGeometry(id)
    +createPhysicalGroup()
    +updatePhysicalGroup(id)
    +deletePhysicalGroup(id)
    +generateMesh()
    +exportFile()
  }

  %% Relations
  App --> ApiClient : uses
  App --> ProjectState : holds
  ProjectState --> Geometry : contains
  ProjectState --> PhysicalGroup : contains
  ProjectState --> MeshSettings : contains
  ProjectState --> ViewerState : contains
  Geometry --> Mesh : contains
  Mesh --> MeshNode : aggregates

  ApiClient --> FastAPIApp : HTTP
  FastAPIApp --> Geometry : returns
  FastAPIApp --> BoxRequest : validates
  FastAPIApp --> SphereRequest : validates
  FastAPIApp --> CylinderRequest : validates
  FastAPIApp --> PhysicalGroupRequest : validates
  FastAPIApp --> MeshRequest : validates
  FastAPIApp --> ExportRequest : validates
  FastAPIApp --> GmshService : meshes
  FastAPIApp --> ProjectRecord : persists
  FastAPIApp --> AuthSession : issues
