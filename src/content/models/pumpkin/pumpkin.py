"""Low-poly jack-o'-lantern from `src/content/models/pumpkin-design.jpeg`.

    blender -b -P src/content/models/pumpkin/pumpkin.py [-- --no-render]

Body stays solid: the face is a boolean intrude of shallow pockets whose floors
glow, so there is no inner shell and no cavity to pay for. Front = -Y.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEWS = os.path.join(HERE, "previews")

BODY = {
    "segments": 32,
    "rings": 10,
    "rx": 1.08,
    "ry": 1.04,
    "rz": 0.85,
    "profile": 0.5,
    "belly": 0.10,
    "lobes": 8,
    "groove": 0.13,
    "groove_sharp": 2.4,
    "front_flatten": 0.95,
    "top_dip": 0.06,
    "dip_radius": 0.38,
}

COLOURS = {
    "shell": "#d05a1a",
    "flesh": "#b5521c",
    "glow": "#ffc626",
    "stem": "#6b472e",
}

POCKET_DEPTH = 0.075


def srgb(hex_string):
    h = hex_string.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def smoothstep(t):
    t = clamp(t)
    return t * t * (3.0 - 2.0 * t)


def groove(phi):
    return ((1.0 - math.cos(BODY["lobes"] * phi)) * 0.5) ** BODY["groove_sharp"]


def body_vertex(phi, u):
    r = (1.0 - u * u) ** BODY["profile"] * (1.0 - BODY["belly"] * u)
    m = 1.0 - BODY["groove"] * groove(phi) * min(1.0, r * 2.6)
    x = BODY["rx"] * r * m * math.sin(phi)
    y = -BODY["ry"] * r * m * math.cos(phi)
    if y < 0.0:
        y *= BODY["front_flatten"]
    z = BODY["rz"] * u
    rho = math.hypot(x, y)
    z -= BODY["top_dip"] * math.exp(-((rho / BODY["dip_radius"]) ** 2)) * smoothstep((u + 0.1) / 1.1) ** 2
    return Vector((x, y, z))


def finish(mesh_name, verts, faces, face_materials=None):
    mesh = bpy.data.meshes.new(mesh_name)
    mesh.from_pydata(verts, [], faces)
    if face_materials is not None:
        mesh.polygons.foreach_set("material_index", face_materials)
    mesh.validate()
    obj = bpy.data.objects.new(mesh_name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.calc_volume(signed=True) < 0.0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def build_body():
    seg = BODY["segments"]
    rings = BODY["rings"]
    verts = []
    faces = []
    for j in range(1, rings):
        u = math.cos(math.pi * j / rings)
        for i in range(seg):
            verts.append(body_vertex(2.0 * math.pi * i / seg, u))
    top = len(verts)
    verts.append(body_vertex(0.0, 1.0))
    bottom = len(verts)
    verts.append(body_vertex(0.0, -1.0))

    row = lambda j: (j - 1) * seg
    for j in range(1, rings - 1):
        a = row(j)
        b = row(j + 1)
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append((a + i, a + i2, b + i2, b + i))
    for i in range(seg):
        i2 = (i + 1) % seg
        faces.append((top, row(1) + i, row(1) + i2))
        faces.append((bottom, row(rings - 1) + i, row(rings - 1) + i2))
    return finish("PumpkinBody", verts, faces)


def sphere_bvh(obj):
    return BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())


def arc(cx, cz, rx, rz, a0, a1, steps):
    return [
        (cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
         cz + rz * math.sin(math.radians(a0 + (a1 - a0) * i / steps)))
        for i in range(steps + 1)
    ]


# --- face features, authored in the front (x, z) plane, eye origin at its base

def eye_path():
    """Tall arch, with a fat finger rising from the lip and curling outward."""
    pts = arc(0.00, 0.00, 0.29, 0.46, 180, 0, 10)
    pts += [
        (0.155, 0.00),
        (0.165, 0.10),
        (0.150, 0.19),
        (0.100, 0.275),
        (0.030, 0.290),
        (-0.025, 0.250),
        (-0.050, 0.180),
        (-0.055, 0.090),
        (-0.045, 0.000),
    ]
    return pts


def nose_path():
    return [
        (0.022, 0.145),
        (0.105, -0.075),
        (0.060, -0.120),
        (-0.060, -0.120),
        (-0.105, -0.075),
        (-0.022, 0.145),
    ]


def mouth_path():
    upper = [
        (-0.700, -0.130),
        (-0.480, -0.205),
        (-0.140, -0.245),
        (0.140, -0.245),
        (0.480, -0.205),
        (0.700, -0.130),
    ]
    lower = [
        (0.690, -0.245),
        (0.520, -0.365),
        (0.280, -0.480),
        (0.185, -0.530),
        (0.145, -0.530),
        (0.130, -0.410),
        (0.045, -0.390),
        (-0.045, -0.390),
        (-0.130, -0.410),
        (-0.145, -0.530),
        (-0.185, -0.530),
        (-0.280, -0.480),
        (-0.520, -0.365),
        (-0.690, -0.245),
    ]
    return upper + lower


def transform_path(points, scale, offset, mirror=1.0):
    return [(x * scale[0] * mirror + offset[0], z * scale[1] + offset[1]) for x, z in points]


# --- cutter: straight prism through the shell, floor rides the shell ----

def surface(frame, x, z):
    hit, normal, _index, _dist = frame.ray_cast(Vector((x, -6.0, z)), Vector((0.0, 1.0, 0.0)))
    if hit is None:
        raise RuntimeError(f"feature point ({x:.3f}, {z:.3f}) misses the body")
    return hit, normal


def area2(poly):
    total = 0.0
    for i in range(len(poly)):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % len(poly)]
        total += x1 * z2 - x2 * z1
    return total * 0.5


def point_in_triangle(p, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
    neg = d1 < -1e-9 or d2 < -1e-9 or d3 < -1e-9
    pos = d1 > 1e-9 or d2 > 1e-9 or d3 > 1e-9
    return not (neg and pos)


def triangulate_2d(poly):
    """Ear clipping; a centroid fan folds over concave paths like the grin."""
    order = list(range(len(poly)))
    if area2(poly) < 0.0:
        order.reverse()
    tris = []

    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    while len(order) > 3:
        for k in range(len(order)):
            i0, i1, i2 = order[k - 1], order[k], order[(k + 1) % len(order)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if cross(a, b, c) <= 1e-9:
                continue
            if any(point_in_triangle(poly[j], a, b, c) for j in order if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            order.pop(k)
            break
        else:
            raise RuntimeError("feature path is self-intersecting")
    tris.append(tuple(order))
    return tris


def build_cutter(name, path, frame, depth=POCKET_DEPTH, inset=0.96, margin=0.005):
    """Three rings: far outside, the authored opening, and a beveled floor that
    follows the shell. The pocket rim lands on the drawn outline."""
    ys = [surface(frame, x, z)[0].y for x, z in path]
    count = len(path)
    cx = sum(px for px, _pz in path) / count
    cz = sum(pz for _px, pz in path) / count
    inner = [(cx + (x - cx) * inset, cz + (z - cz) * inset) for x, z in path]

    far = [(x, ys[i] - 0.5, z) for i, (x, z) in enumerate(path)]
    rim = [(x, ys[i] - margin, z) for i, (x, z) in enumerate(path)]
    floor = [(x, surface(frame, x, z)[0].y + depth, z) for x, z in inner]
    verts = far + rim + floor

    faces = []
    materials = []
    for ring in (0, count):
        for i in range(count):
            j = (i + 1) % count
            faces.append((ring + i, ring + j, ring + count + j, ring + count + i))
            materials.append(0)
    for a, b, c in triangulate_2d(path):
        faces.append((a, c, b))
        materials.append(0)
        faces.append((2 * count + a, 2 * count + b, 2 * count + c))
        materials.append(1)

    cutter = finish(name, verts, faces, materials)
    cutter.data.materials.append(bpy.data.materials["PumpkinFlesh"])
    cutter.data.materials.append(bpy.data.materials["PumpkinGlow"])
    return cutter


# --- stem ------------------------------------------------------------------

def build_tube(name, points, radii, sides=8):
    points = [Vector(p) for p in points]
    count = len(points)
    frames = []
    normal = Vector((1.0, 0.0, 0.0))
    for i, p in enumerate(points):
        if i == 0:
            tangent = points[1] - p
        elif i == count - 1:
            tangent = p - points[i - 1]
        else:
            tangent = points[i + 1] - points[i - 1]
        tangent.normalize()
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        frames.append((normal, tangent.cross(normal)))

    verts = []
    for i, p in enumerate(points):
        normal, bitangent = frames[i]
        for s in range(sides):
            a = 2.0 * math.pi * s / sides
            verts.append(tuple(p + (normal * math.cos(a) + bitangent * math.sin(a)) * radii[i]))

    faces = []
    for i in range(count - 1):
        for s in range(sides):
            s2 = (s + 1) % sides
            faces.append((i * sides + s, i * sides + s2, (i + 1) * sides + s2, (i + 1) * sides + s))
    faces.append(tuple(range(sides))[::-1])
    last = (count - 1) * sides
    faces.append(tuple(last + s for s in range(sides)))
    return finish(name, verts, faces)


def build_stem():
    """Gourd stem: flared collar, kinked shaft, blunt cut top."""
    path = [
        (0.00, 0.00, 0.60),
        (0.02, 0.00, 0.72),
        (0.05, -0.01, 0.84),
        (0.04, 0.00, 0.95),
        (-0.01, 0.01, 1.04),
        (-0.07, 0.02, 1.11),
    ]
    radii = [0.28, 0.215, 0.19, 0.175, 0.16, 0.145]
    return build_tube("PumpkinStem", path, radii, sides=8)


def build_tendril():
    points = []
    radii = []
    steps = 16
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(250.0 + 430.0 * t)
        r = 0.16 * (1.0 - 0.5 * t)
        points.append((0.20 + r * math.cos(a), -0.03 + 0.02 * t, 0.92 + r * math.sin(a)))
        radii.append(0.045 * (1.0 - 0.35 * t))
    return build_tube("PumpkinTendril", points, radii, sides=5)


# --- materials, shading, scene ---------------------------------------------

def make_material(name, colour, roughness=0.5, emission=0.0, emission_colour=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(colour)
    bsdf.inputs["Roughness"].default_value = roughness
    if emission > 0.0:
        bsdf.inputs["Emission Color"].default_value = srgb(emission_colour or colour)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def split_shading(obj, angle=38.0):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.set_sharp_from_angle(angle=math.radians(angle))


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 96
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.82, 0.79, 0.74, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    scene.world = world
    for name, loc, energy, size in (
        ("Key", (-3.2, -4.2, 4.0), 700.0, 5.0),
        ("Fill", (4.2, -2.6, 1.4), 180.0, 5.0),
        ("Rim", (0.4, 4.2, 3.2), 320.0, 4.0),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        light.location = loc
        light.rotation_euler = (Vector((0.0, 0.0, 0.35)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(light)


def render_views():
    os.makedirs(PREVIEWS, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.image_settings.file_format = "PNG"
    camera_data = bpy.data.cameras.new("PreviewCam")
    camera = bpy.data.objects.new("PreviewCam", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    target = Vector((0.0, 0.0, 0.15))
    views = {
        "front": ((0.0, -7.0, 0.15), "ORTHO", 3.0),
        "side": ((7.0, 0.0, 0.15), "ORTHO", 3.0),
        "top": ((0.0, 0.0, 7.0), "ORTHO", 3.0),
        "hero": ((3.4, -5.0, 2.2), "PERSP", 0.0),
    }
    for name, (loc, kind, ortho) in views.items():
        camera_data.type = kind
        camera_data.ortho_scale = ortho
        camera_data.lens = 70.0
        camera.location = loc
        if name == "top":
            camera.rotation_euler = (0.0, 0.0, 0.0)
        else:
            camera.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(PREVIEWS, f"{name}.png")
        bpy.ops.render.render(write_still=True)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main():
    setup_scene()
    for name, colour, rough, emit in (
        ("PumpkinShell", COLOURS["shell"], 0.5, 0.0),
        ("PumpkinFlesh", COLOURS["flesh"], 0.62, 0.25),
        ("PumpkinGlow", COLOURS["glow"], 0.9, 1.1),
        ("PumpkinStem", COLOURS["stem"], 0.62, 0.0),
    ):
        make_material(name, colour, rough, emit, COLOURS["glow"])

    body = build_body()
    for name in ("PumpkinShell", "PumpkinFlesh", "PumpkinGlow"):
        body.data.materials.append(bpy.data.materials[name])
    frame = sphere_bvh(body)

    eye = eye_path()
    features = [
        transform_path(eye, (1.0, 0.92), (-0.44, 0.12), 1.0),
        transform_path(eye, (1.0, 0.92), (0.44, 0.12), -1.0),
        transform_path(nose_path(), (1.0, 1.0), (0.0, -0.03)),
        mouth_path(),
    ]

    for index, path in enumerate(features):
        cutter = build_cutter(f"Cut{index}", path, frame)
        mod = body.modifiers.new(f"Cut{index}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    split_shading(body)

    for part in (build_stem(), build_tendril()):
        part.data.materials.append(bpy.data.materials["PumpkinStem"])
        split_shading(part, 46.0)

    counts = [tri_count(o) for o in bpy.data.objects if o.type == "MESH"]
    print(f"TRIS per-object={counts} total={sum(counts)}")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "pumpkin.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "pumpkin.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    if "--no-render" not in sys.argv:
        render_views()


main()
