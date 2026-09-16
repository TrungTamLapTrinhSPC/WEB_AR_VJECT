"""
IFC to GLB & USDZ Conversion Script using IfcOpenShell & Pixar USD (pxr)
PA3 AR/BIM System High-Precision Converter
"""

import sys
import os
import json
import argparse
import subprocess
import re

# Force UTF-8 encoding for standard streams (especially on Windows)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

try:
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.unit
except ImportError:
    print("Error: IfcOpenShell is not installed. Run: pip install ifcopenshell")
    sys.exit(1)


def sanitize_usd_name(name):
    """Sanitize string to be a valid USD Prim name ([a-zA-Z_][a-zA-Z0-9_]*)"""
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    if not sanitized or not (sanitized[0].isalpha() or sanitized[0] == '_'):
        sanitized = '_' + sanitized
    return sanitized


#: Lớp thuộc cấu trúc không gian, không phải cấu kiện — không bao giờ có mặt
#: trong lưới nên cũng không được tính vào `total_elements`.
SPATIAL_CLASSES = (
    'IfcOpeningElement', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey',
    'IfcSpace', 'IfcGrid', 'IfcAnnotation',
)


def extract_metadata(ifc_file, rtc_offset=None, unit_scale=1.0, mesh_names=None):
    """
    Trích thuộc tính cấu kiện từ file IFC.

    `mesh_names` là bảng `GlobalId` → tên lưới do `convert_ifc_to_obj` trả về.
    Nhờ nó mỗi cấu kiện trong metadata nối được với đúng khối hình học của nó,
    thay vì để app phải đoán ngược từ tên lưới đã bị làm sạch.
    """
    print(f"[1/4] Extracting BIM metadata from IFC file...")
    mesh_names = mesh_names or {}
    metadata = {
        "elements": [],
        "summary": {}
    }

    products = ifc_file.by_type("IfcProduct")
    type_counts = {}
    with_geometry = 0

    for product in products:
        if product.is_a() in SPATIAL_CLASSES:
            continue

        p_type = product.is_a()
        type_counts[p_type] = type_counts.get(p_type, 0) + 1

        mesh_name = mesh_names.get(product.GlobalId)
        if mesh_name:
            with_geometry += 1

        elem_data = {
            # `id` giữ nguyên để không phá client cũ; `global_id` là tên trường
            # mà app thực sự tìm (xem `IndoorAPIService.loadMetadataMap`).
            "id": product.GlobalId,
            "global_id": product.GlobalId,
            # Tên khối hình học tương ứng trong GLB/USDZ. `None` nghĩa là cấu
            # kiện này không có hình học trong lưới — app không nên chờ chạm được.
            "mesh_name": mesh_name,
            "name": product.Name or "Unnamed",
            "type": p_type,
            "properties": {}
        }

        # Extract Property Sets (Psets)
        if hasattr(product, "IsDefinedBy"):
            for rel in product.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    pset = rel.RelatingPropertyDefinition
                    if pset.is_a("IfcPropertySet"):
                        for prop in pset.HasProperties:
                            if prop.is_a("IfcPropertySingleValue"):
                                # Một thuộc tính hỏng không được phép giết cả lượt
                                # trích xuất — bản cũ không bắt lỗi ở đây, nên chỉ
                                # cần một NominalValue lạ là mất sạch metadata.
                                try:
                                    value = str(prop.NominalValue.wrappedValue) if prop.NominalValue else None
                                except Exception:
                                    value = None
                                elem_data["properties"][f"{pset.Name}.{prop.Name}"] = value

        metadata["elements"].append(elem_data)

    metadata["summary"] = {
        "total_elements": len(metadata["elements"]),
        # Bản cũ chỉ có `total_elements`, mà con số đó đếm cả cấu kiện KHÔNG có
        # hình học, nên không đối chiếu được với những gì thực sự hiện ra trong AR.
        "elements_with_geometry": with_geometry,
        "type_counts": type_counts,
        # ⚠️ Chỉ để tham khảo. Hình học IfcOpenShell trả về ĐÃ quy về mét rồi,
        # KHÔNG được đem số này nhân thêm lần nữa — làm vậy là sai đúng 1000 lần
        # với file khai bằng milimét.
        "length_unit_scale_to_meters": unit_scale,
        "rtc_center_offset": rtc_offset or [0.0, 0.0, 0.0]
    }
    return metadata


DEFAULT_COLOR = (0.72, 0.74, 0.76)

DISCIPLINE_COLORS = {
    # ── Cấp thoát nước ──
    'IfcFlowSegment': (0.18, 0.53, 0.86),       # Ống nước - xanh kim loại (#2E87DB)
    'IfcFlowFitting': (0.12, 0.42, 0.72),       # Phụ kiện ống - xanh đậm (#1F6CB5)
    'IfcFlowTerminal': (0.90, 0.90, 0.92),      # Thiết bị vệ sinh - trắng sứ (#E6E6EA)
    'IfcPipeSegment': (0.18, 0.53, 0.86),       # (chỉ có trong IFC4)
    'IfcPipeFitting': (0.12, 0.42, 0.72),       # (chỉ có trong IFC4)
    'IfcSanitaryTerminal': (0.90, 0.90, 0.92),
    # ── Điều hoà thông gió ──
    'IfcDuctSegment': (0.85, 0.55, 0.20),       # Ống gió - cam mạ kẽm (#D98C33)
    'IfcDuctFitting': (0.75, 0.45, 0.15),       # Phụ kiện gió - cam đậm (#BF7326)
    'IfcAirTerminal': (0.95, 0.80, 0.55),       # Miệng gió
    # ── Điện ──
    'IfcCableCarrierSegment': (0.95, 0.75, 0.10),  # Máng cáp - vàng (#F2BF1A)
    'IfcCableCarrierFitting': (0.85, 0.67, 0.09),
    'IfcCableSegment': (0.98, 0.85, 0.30),
    'IfcElectricAppliance': (0.90, 0.70, 0.10),    # Thiết bị điện - vàng kim (#E6B31A)
    'IfcElectricDistributionBoard': (0.88, 0.66, 0.12),
    'IfcLightFixture': (1.00, 0.95, 0.70),
    'IfcOutlet': (0.90, 0.70, 0.10),
    'IfcSwitchingDevice': (0.90, 0.70, 0.10),
    # ── Chữa cháy ──
    'IfcFireSuppressionTerminal': (0.85, 0.15, 0.15),  # Đầu phun - đỏ an toàn (#D92626)
    # ── Kết cấu ──
    'IfcWall': (0.75, 0.75, 0.78),              # Tường - bê tông xám nhạt (#BFBFC7)
    'IfcWallStandardCase': (0.75, 0.75, 0.78),
    'IfcSlab': (0.65, 0.65, 0.68),              # Sàn - bê tông xám (#A6A6AD)
    'IfcColumn': (0.60, 0.62, 0.65),            # Cột - xám đậm (#999EA6)
    'IfcBeam': (0.58, 0.60, 0.63),              # Dầm - xám thép (#9499A1)
    'IfcFooting': (0.52, 0.54, 0.57),           # Móng - xám sẫm
    'IfcPile': (0.50, 0.52, 0.55),              # Cọc
    'IfcMember': (0.58, 0.60, 0.63),            # Thanh giằng / kèo
    'IfcPlate': (0.62, 0.64, 0.67),             # Bản mã
    'IfcRamp': (0.68, 0.68, 0.71),
    'IfcStair': (0.68, 0.68, 0.71),
    'IfcStairFlight': (0.68, 0.68, 0.71),
    'IfcRailing': (0.55, 0.57, 0.60),
    'IfcRoof': (0.60, 0.45, 0.40),
    # Cốt thép: thiếu khoá này thì TOÀN BỘ thanh thép rơi về màu xám mặc định,
    # trùng luôn màu bê tông bọc quanh nó. Với một file kết cấu điển hình đó là
    # phần lớn số cấu kiện — file mẫu SDC_ST.ifc có 522/530 là IfcReinforcingBar.
    'IfcReinforcingBar': (0.85, 0.42, 0.22),    # Thép thanh - nâu cam gỉ
    'IfcReinforcingMesh': (0.80, 0.40, 0.20),   # Lưới thép
    'IfcTendon': (0.70, 0.35, 0.18),            # Cáp dự ứng lực
    'IfcTendonAnchor': (0.62, 0.30, 0.15),
    # ── Kiến trúc ──
    'IfcDoor': (0.55, 0.35, 0.20),              # Cửa đi - nâu gỗ (#8C5933)
    'IfcWindow': (0.40, 0.65, 0.80),            # Cửa sổ - xanh kính (#66A6CC)
    'IfcCurtainWall': (0.45, 0.68, 0.82),
    'IfcCovering': (0.82, 0.80, 0.76),          # Trần / lớp phủ
    'IfcFurnishingElement': (0.70, 0.58, 0.45),
}

#: Ánh xạ `PredefinedType` → màu, dùng khi lớp của thể hiện quá chung chung.
#:
#: ⚠️ VÌ SAO CẦN BẢNG NÀY: file do Revit xuất mặc định theo schema **IFC2X3**
#: (file mẫu SDC_ST.ifc cũng vậy), mà IFC2X3 KHÔNG có các lớp `IfcDuctSegment`,
#: `IfcPipeSegment`, `IfcCableSegment`… Chúng chỉ xuất hiện từ IFC4. Trong IFC2X3
#: ống gió và ống nước ĐỀU trả về `IfcFlowSegment`, phân biệt nhau bằng
#: `PredefinedType` của kiểu (`IfcRelDefinesByType`). Tra theo lớp không thôi là
#: cả hệ thống gió và hệ thống nước nhận CÙNG một màu xanh.
PREDEFINED_TYPE_COLORS = {
    'DUCTSEGMENT': (0.85, 0.55, 0.20),
    'DUCTFITTING': (0.75, 0.45, 0.15),
    'PIPESEGMENT': (0.18, 0.53, 0.86),
    'PIPEFITTING': (0.12, 0.42, 0.72),
    'CABLESEGMENT': (0.98, 0.85, 0.30),
    'CABLECARRIERSEGMENT': (0.95, 0.75, 0.10),
    'AIRTERMINAL': (0.95, 0.80, 0.55),
    'SANITARYTERMINAL': (0.90, 0.90, 0.92),
    'FIRESUPPRESSIONTERMINAL': (0.85, 0.15, 0.15),
    'LIGHTFIXTURE': (1.00, 0.95, 0.70),
    'ELECTRICAPPLIANCE': (0.90, 0.70, 0.10),
}


#: Các lớp IFC2X3 quá chung chung để suy ra bộ môn — phải hỏi `PredefinedType`.
#: Trong IFC2X3 mọi đoạn ống, dù là gió, nước hay cáp, đều là `IfcFlowSegment`.
AMBIGUOUS_FLOW_CLASSES = {
    'IfcFlowSegment',
    'IfcFlowFitting',
    'IfcFlowTerminal',
    'IfcFlowController',
    'IfcFlowMovingDevice',
    'IfcFlowStorageDevice',
    'IfcFlowTreatmentDevice',
    'IfcEnergyConversionDevice',
    'IfcDistributionElement',
    'IfcDistributionFlowElement',
    'IfcDistributionControlElement',
    'IfcBuildingElementProxy',
}


def predefined_type_of(product):
    """
    `PredefinedType` của cấu kiện, ưu tiên kiểu (`IfcRelDefinesByType`) rồi mới
    tới bản thân thể hiện. Trả về chuỗi in hoa, hoặc None.
    """
    try:
        for rel in getattr(product, 'IsDefinedBy', None) or []:
            if rel.is_a('IfcRelDefinesByType'):
                ptype = getattr(rel.RelatingType, 'PredefinedType', None)
                if ptype and str(ptype) not in ('NOTDEFINED', 'USERDEFINED'):
                    return str(ptype).upper()
    except Exception:
        pass

    try:
        ptype = getattr(product, 'PredefinedType', None)
        if ptype and str(ptype) not in ('NOTDEFINED', 'USERDEFINED'):
            return str(ptype).upper()
    except Exception:
        pass
    return None


def get_product_color(product, shape):
    """Màu cấu kiện: vật liệu trong file → PredefinedType → lớp IFC → mặc định."""
    g = shape.geometry
    if hasattr(g, 'materials') and len(g.materials) > 0:
        m = g.materials[0]
        if hasattr(m, 'diffuse'):
            try:
                r = float(m.diffuse.r())
                g_val = float(m.diffuse.g())
                b = float(m.diffuse.b())
                # (0.7, 0.7, 0.7) là màu vật liệu mặc định IfcOpenShell tự gán khi
                # cấu kiện không khai vật liệu — không phải màu thật, phải bỏ qua.
                if not (abs(r - 0.7) < 0.02 and abs(g_val - 0.7) < 0.02 and abs(b - 0.7) < 0.02):
                    return (round(r, 3), round(g_val, 3), round(b, 3))
            except Exception:
                pass

    ifc_class = product.is_a()

    # Với lớp CHUNG CHUNG của IFC2X3, `PredefinedType` phải thắng: bản thân lớp
    # không nói được đây là ống gió hay ống nước. Với lớp riêng của IFC4 thì
    # ngược lại, lớp đã đủ rõ nghĩa nên tra thẳng bảng màu.
    if ifc_class in AMBIGUOUS_FLOW_CLASSES:
        ptype = predefined_type_of(product)
        if ptype and ptype in PREDEFINED_TYPE_COLORS:
            return PREDEFINED_TYPE_COLORS[ptype]

    by_class = DISCIPLINE_COLORS.get(ifc_class)
    if by_class is not None:
        return by_class

    ptype = predefined_type_of(product)
    if ptype and ptype in PREDEFINED_TYPE_COLORS:
        return PREDEFINED_TYPE_COLORS[ptype]

    return DEFAULT_COLOR


#: Dung sai chia lưới mặc định — xem giải thích trong `convert_ifc_to_obj`.
DEFAULT_LINEAR_DEFLECTION = 0.001   # mét
DEFAULT_ANGULAR_DEFLECTION = 0.5    # radian


def convert_ifc_to_obj(ifc_path, obj_path,
                       linear_deflection=DEFAULT_LINEAR_DEFLECTION,
                       angular_deflection=DEFAULT_ANGULAR_DEFLECTION):
    """
    Convert IFC file to high-precision OBJ format using IfcOpenShell geometry engine.
    Applies Unit Scaling (to Meters), Centroid Offset (RTC), and Z-up to Y-up transform.
    """
    print(f"[2/4] Generating High-Precision 3D Geometry OBJ mesh from {ifc_path}...")
    ifc_file = ifcopenshell.open(ifc_path)
    
    # Calculate length unit scale factor relative to meters
    try:
        unit_scale = ifcopenshell.util.unit.calculate_unit_scale(ifc_file)
    except Exception as e:
        print(f"Warning: Could not calculate unit scale automatically, defaulting to 1.0 (meters). Error: {e}")
        unit_scale = 1.0

    print(f"   -> Length unit scale factor to meters: {unit_scale}")
    
    # High-precision geometry extraction settings
    settings = ifcopenshell.geom.settings()
    settings.set('use-world-coords', True)  # CRITICAL: Fix duplicate components being stacked at local (0,0,0)
    settings.set('weld-vertices', True)
    settings.set('unify-shapes', True)
    settings.set('apply-default-materials', True)
    
    # ── DUNG SAI CHIA LƯỚI ────────────────────────────────────────────────────
    # Hai dung sai này cùng chi phối, bộ chia lưới lấy cái NÀO CHẶT HƠN.
    #
    # Cặp cũ (thẳng 5mm + góc 0.1 rad) sai với cỡ hình học của mô hình kết cấu:
    #
    #   • Thanh thép Ø20 có bán kính 10mm. Dung sai thẳng 5mm bằng NỬA bán kính,
    #     tức cho phép rút vòng tròn tiết diện xuống còn TAM GIÁC.
    #   • Dung sai góc 0.1 rad lại đòi ~63 cạnh mỗi vòng tròn. Nhân với 522 thanh
    #     thép trong một file là bùng nổ số tam giác, mà USDZ thì không được nén.
    #
    # Nghĩa là tuỳ cái nào thắng, kết quả đều xấu: hoặc thép thành lăng trụ tam
    # giác, hoặc mô hình nặng tới mức máy không dựng nổi.
    #
    # Cặp mới (thẳng 1mm + góc 0.5 rad) để dung sai THẲNG cầm lái, vì chỉ nó mới
    # co giãn theo kích thước cấu kiện:
    #
    #   Bán kính   Dung sai thẳng đòi   Dung sai góc đòi   Thực nhận
    #   10mm       7 cạnh               13 cạnh            13
    #   150mm      27 cạnh              13 cạnh            27
    #
    # Ống lớn được chia mịn hơn thanh thép, đúng như mong muốn.
    settings.set('mesher-linear-deflection', linear_deflection)
    settings.set('mesher-angular-deflection', angular_deflection)

    # Fallback settings for complex curved fittings if boolean subtractions fail
    fallback_settings = ifcopenshell.geom.settings()
    fallback_settings.set('use-world-coords', True)
    fallback_settings.set('weld-vertices', True)
    fallback_settings.set('unify-shapes', True)
    # Phải dùng CÙNG dung sai với `settings`. Bản cũ để lệch (5mm/0.1rad so với
    # cặp chính), nên cấu kiện nào rơi xuống nhánh dự phòng lại được chia lưới
    # theo một độ mịn khác hẳn — hai cấu kiện cạnh nhau trong cùng mô hình có độ
    # chi tiết khác nhau mà không rõ vì sao.
    fallback_settings.set('mesher-linear-deflection', linear_deflection)
    fallback_settings.set('mesher-angular-deflection', angular_deflection)
    # Thiếu dòng này ở bản cũ: cấu kiện đi nhánh dự phòng không được gán vật liệu
    # mặc định, nên `get_product_color` đọc rỗng và rơi về màu xám chung.
    fallback_settings.set('apply-default-materials', True)
    fallback_settings.set('disable-boolean-result', True)

    def extract_shape(prod):
        try:
            return ifcopenshell.geom.create_shape(settings, prod)
        except Exception as e1:
            try:
                # Try fallback without boolean cutouts for complex curved pipe fittings/elbows
                return ifcopenshell.geom.create_shape(fallback_settings, prod)
            except Exception as e2:
                print(f"Warning: Could not create shape for {prod.is_a()} GlobalId={prod.GlobalId}: {e1}")
                return None
    
    products = ifc_file.by_type("IfcProduct")
    
    # First Pass: Compute Bounding Box Centroid (RTC Offset) in Meters
    print("   -> Calculating model centroid (RTC Offset) for sub-millimeter precision...")
    min_bounds = [float('inf'), float('inf'), float('inf')]
    max_bounds = [float('-inf'), float('-inf'), float('-inf')]
    
    valid_products = []
    for product in products:
        if product.is_a("IfcOpeningElement") or product.is_a("IfcGrid") or not product.Representation:
            continue
        shape = extract_shape(product)
        if shape is None:
            continue
        
        # IfcOpenShell outputs vertices natively in meters
        verts = shape.geometry.verts
        for i in range(0, len(verts), 3):
            vx = verts[i]
            vy = verts[i+1]
            vz = verts[i+2]
            min_bounds[0] = min(min_bounds[0], vx)
            min_bounds[1] = min(min_bounds[1], vy)
            min_bounds[2] = min(min_bounds[2], vz)
            max_bounds[0] = max(max_bounds[0], vx)
            max_bounds[1] = max(max_bounds[1], vy)
            max_bounds[2] = max(max_bounds[2], vz)
        
        color = get_product_color(product, shape)
        valid_products.append((product, shape, color))
            
    if min_bounds[0] != float('inf'):
        rtc_center = [
            (min_bounds[0] + max_bounds[0]) / 2.0,
            (min_bounds[1] + max_bounds[1]) / 2.0,
            (min_bounds[2] + max_bounds[2]) / 2.0
        ]
    else:
        rtc_center = [0.0, 0.0, 0.0]

    print(f"   -> Centroid RTC Offset (Meters, IFC space): X={rtc_center[0]:.4f}, Y={rtc_center[1]:.4f}, Z={rtc_center[2]:.4f}")
    
    # Create companion MTL file for OBJ materials
    mtl_path = obj_path.replace('.obj', '.mtl')
    mtl_filename = os.path.basename(mtl_path)
    used_colors = set(item[2] for item in valid_products)

    with open(mtl_path, 'w', encoding='utf-8') as mtl_file:
        mtl_file.write("# PA3 Material Library\n")
        for color in used_colors:
            color_hex = f"{int(color[0]*255):02x}{int(color[1]*255):02x}{int(color[2]*255):02x}"
            mat_name = f"Mat_{color_hex}"
            mtl_file.write(f"newmtl {mat_name}\n")
            mtl_file.write(f"Kd {color[0]:.3f} {color[1]:.3f} {color[2]:.3f}\n")
            mtl_file.write(f"Ka {color[0]:.3f} {color[1]:.3f} {color[2]:.3f}\n")
            mtl_file.write("Ks 0.1 0.1 0.1\nNs 10.0\n\n")

    # Bảng tra `GlobalId` → tên lưới trong OBJ/GLB/USDZ, để metadata nối được
    # cấu kiện 3D với thuộc tính của nó. Xem giải thích ở chỗ gán.
    mesh_names = {}
    total_triangles = 0

    # Second Pass: Write OBJ Mesh with RTC Centroid Offset + Z-up to Y-up Axis Conversion
    with open(obj_path, 'w', encoding='utf-8') as obj_file:
        obj_file.write("# PA3 AR/BIM High-Precision OBJ Exporter via IfcOpenShell\n")
        obj_file.write(f"mtllib {mtl_filename}\n")

        vertex_offset = 1
        
        for idx, (product, shape, color) in enumerate(valid_products, 1):
            verts = shape.geometry.verts
            faces = shape.geometry.faces
            
            clean_guid = sanitize_usd_name(f"{product.is_a()}_{product.GlobalId}_{idx}")
            # Ghi lại tên lưới ↔ GlobalId. `sanitize_usd_name` là phép ánh xạ MẤT
            # THÔNG TIN nên KHÔNG suy ngược được: bảng chữ cái của GlobalId gồm cả
            # `_` và `$`, mà cả hai đều bị đổi thành `_`. App từng cắt tên theo `_`
            # rồi lấy phần tử thứ hai, nên với `IfcBeam_1_bWs7b3H5UfL5yBX6SipE_1`
            # nó đi tra chuỗi "1". Mọi cấu kiện có `_` trong mã đều tra hỏng, còn
            # `$` thì mất hẳn. Cách duy nhất đúng là ghi bảng tra ra metadata.
            mesh_names[product.GlobalId] = clean_guid
            color_hex = f"{int(color[0]*255):02x}{int(color[1]*255):02x}{int(color[2]*255):02x}"
            mat_name = f"Mat_{color_hex}"

            obj_file.write(f"o {clean_guid}\n")
            obj_file.write(f"usemtl {mat_name}\n")
            obj_file.write(f"# color:{color[0]:.3f},{color[1]:.3f},{color[2]:.3f}\n")
            
            # Write Vertices (High Precision 8 decimals, meter scale, RTC subtracted, Y-up)
            for i in range(0, len(verts), 3):
                vx = verts[i] - rtc_center[0]
                vy = verts[i+1] - rtc_center[1]
                vz = verts[i+2] - rtc_center[2]
                
                # Z-up to Y-up mapping: X_yup = vx, Y_yup = vz, Z_yup = -vy
                x_yup = vx
                y_yup = vz
                z_yup = -vy
                
                obj_file.write(f"v {x_yup:.8f} {y_yup:.8f} {z_yup:.8f}\n")
            
            # Write Faces
            for i in range(0, len(faces), 3):
                f1 = faces[i] + vertex_offset
                f2 = faces[i+1] + vertex_offset
                f3 = faces[i+2] + vertex_offset
                obj_file.write(f"f {f1} {f2} {f3}\n")
            
            vertex_offset += len(verts) // 3
            total_triangles += len(faces) // 3

    print(f"[SUCCESS] High-precision OBJ file generated successfully: {obj_path}")
    # Số tam giác là thước đo trực tiếp của việc chọn dung sai chia lưới. In ra
    # để thấy ngay khi một mô hình nhiều cốt thép bị chia quá mịn — trước đây
    # chỉ phát hiện được lúc máy không dựng nổi mô hình.
    print(f"   -> Tổng số tam giác: {total_triangles:,} trên {len(valid_products):,} cấu kiện "
          f"(dung sai thẳng {linear_deflection}m, góc {angular_deflection}rad)")
    if total_triangles > 2_000_000:
        print(f"   ⚠️  Trên 2 triệu tam giác — máy di động nhiều khả năng không dựng nổi. "
              f"Tăng --angular-deflection (ví dụ 0.8) rồi chuyển đổi lại.")
    return ifc_file, rtc_center, unit_scale, mesh_names


def convert_obj_to_glb(obj_path, glb_path):
    """
    Convert OBJ file to GLB using obj2gltf CLI or trimesh fallback
    """
    print(f"[3/4] Converting OBJ mesh to GLB format...")
    
    # Try using obj2gltf CLI if available
    try:
        cmd = f"npx -y obj2gltf -i \"{obj_path}\" -o \"{glb_path}\" --binary"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(glb_path):
            print(f"[SUCCESS] Successfully exported GLB via obj2gltf: {glb_path}")
            return True
    except Exception as e:
        print(f"obj2gltf failed, trying trimesh fallback...")

    # Fallback using Python trimesh
    try:
        import trimesh
        scene = trimesh.load(obj_path)
        scene.export(glb_path)
        print(f"[SUCCESS] Successfully exported GLB via trimesh: {glb_path}")
        return True
    except ImportError:
        print("trimesh not installed. Run: pip install trimesh")
        return False
    except Exception as e:
        print(f"trimesh conversion error: {e}")
        return False


def convert_obj_to_usdz(obj_path, usdz_path):
    """
    Convert OBJ 3D mesh directly to native USDZ format with element hierarchy using Pixar USD (pxr) library.
    Configures Y-up stage, 1.0m scale, UsdPreviewSurface materials and native displayColor.
    """
    print(f"[4/4] Converting OBJ mesh directly to USDZ format using Pixar USD (pxr)...")
    try:
        import zipfile
        from pxr import Usd, UsdGeom, UsdShade, Sdf, Vt, Gf

        usda_path = usdz_path.replace('.usdz', '.usda')
        stage = Usd.Stage.CreateNew(usda_path)
        
        # Configure USD Stage metadata for iOS RealityKit / ARKit
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)  # Standard 1.0 Meter per unit

        root_prim = stage.DefinePrim('/BIMModel', 'Xform')
        stage.SetDefaultPrim(root_prim)

        # Parse OBJ objects into separate USD Prims
        objects = []
        current_obj = None
        global_verts = []  # 1-based index lookup

        with open(obj_path, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split()
                if not parts:
                    continue
                if parts[0] == 'o' or parts[0] == 'g':
                    obj_name = sanitize_usd_name(parts[1]) if len(parts) > 1 else f"Element_{len(objects)+1}"
                    current_obj = {'name': obj_name, 'vert_indices': [], 'faces': [], 'color': (0.72, 0.74, 0.76)}
                    objects.append(current_obj)
                elif parts[0] == 'usemtl':
                    if current_obj is not None and len(parts) > 1 and parts[1].startswith("Mat_"):
                        hex_str = parts[1].replace("Mat_", "")
                        if len(hex_str) == 6:
                            r = int(hex_str[0:2], 16) / 255.0
                            g = int(hex_str[2:4], 16) / 255.0
                            b = int(hex_str[4:6], 16) / 255.0
                            current_obj['color'] = (round(r, 3), round(g, 3), round(b, 3))
                elif parts[0] == '#':
                    if current_obj is not None and line.startswith("# color:"):
                        c_str = line.replace("# color:", "").strip()
                        c_parts = [float(x) for x in c_str.split(',')]
                        if len(c_parts) == 3:
                            current_obj['color'] = (c_parts[0], c_parts[1], c_parts[2])
                elif parts[0] == 'v':
                    if current_obj is None:
                        current_obj = {'name': "DefaultElement", 'vert_indices': [], 'faces': [], 'color': (0.72, 0.74, 0.76)}
                        objects.append(current_obj)
                    global_verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
                    # 1-based global vertex index is len(global_verts)
                    current_obj['vert_indices'].append(len(global_verts))
                elif parts[0] == 'f':
                    if current_obj is not None:
                        face = [int(p.split('/')[0]) for p in parts[1:]]
                        current_obj['faces'].append(face)

        # Build USD Prim Meshes
        total_prims = 0
        used_names = set()
        created_materials = {}

        for obj in objects:
            if not obj['vert_indices'] or not obj['faces']:
                continue

            # Map global 1-based vertex indices to local 0-based indexing for this mesh
            v_map = {}
            local_points = []
            for global_idx in obj['vert_indices']:
                v_map[global_idx] = len(local_points)
                local_points.append(global_verts[global_idx - 1])

            local_faces = []
            face_vertex_counts = []
            for face in obj['faces']:
                mapped_f = [v_map[g_idx] for g_idx in face if g_idx in v_map]
                if len(mapped_f) >= 3:
                    local_faces.extend(mapped_f)
                    face_vertex_counts.append(len(mapped_f))

            if not local_points or not local_faces:
                continue

            # Ensure unique prim name
            base_name = obj['name']
            prim_name = base_name
            count = 1
            while prim_name in used_names:
                prim_name = f"{base_name}_{count}"
                count += 1
            used_names.add(prim_name)

            mesh_path = f"/BIMModel/{prim_name}"
            mesh = UsdGeom.Mesh.Define(stage, mesh_path)
            mesh.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(v[0], v[1], v[2]) for v in local_points]))
            mesh.CreateFaceVertexIndicesAttr(Vt.IntArray(local_faces))
            mesh.CreateFaceVertexCountsAttr(Vt.IntArray(face_vertex_counts))

            # ⚠️ BẮT BUỘC với hình học BIM: lược đồ chia nhỏ mặc định của USD là
            # `catmullClark`, tức bộ dựng hình được phép coi lưới này là lưới điều
            # khiển của một mặt cong và BO TRÒN mọi góc. Cột 400×400 co lại thành
            # khối bo, dầm mất cạnh, và sai lệch đó KHÔNG đều nên không hiệu chỉnh
            # bằng tỉ lệ được. Lưới xuất từ IFC đã là lưới tam giác cuối cùng nên
            # phải khai báo rõ là không chia nhỏ nữa.
            mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)

            # Khối bao. Thiếu `extent`, một số bộ dựng hình phải tự quét toàn bộ
            # điểm lúc nạp, và bộ cắt theo tầm nhìn có thể loại nhầm cấu kiện.
            xs = [v[0] for v in local_points]
            ys = [v[1] for v in local_points]
            zs = [v[2] for v in local_points]
            mesh.CreateExtentAttr(Vt.Vec3fArray([
                Gf.Vec3f(min(xs), min(ys), min(zs)),
                Gf.Vec3f(max(xs), max(ys), max(zs))
            ]))

            # Bind UsdPreviewSurface Material & DisplayColor for ARKit / RealityKit
            color = obj.get('color', (0.72, 0.74, 0.76))
            color_hex = f"{int(color[0]*255):02x}{int(color[1]*255):02x}{int(color[2]*255):02x}"
            mat_name = f"Mat_{color_hex}"

            if mat_name not in created_materials:
                mat_path = f"/BIMModel/Materials/{mat_name}"
                material = UsdShade.Material.Define(stage, mat_path)
                shader = UsdShade.Shader.Define(stage, f"{mat_path}/PbrShader")
                shader.CreateIdAttr("UsdPreviewSurface")
                shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(color[0], color[1], color[2]))
                shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.4)
                shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.1)
                material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
                created_materials[mat_name] = material
            else:
                material = created_materials[mat_name]

            UsdShade.MaterialBindingAPI(mesh).Bind(material)
            mesh.CreateDisplayColorAttr(Vt.Vec3fArray([Gf.Vec3f(color[0], color[1], color[2])]))
            
            total_prims += 1

        stage.GetRootLayer().Save()

        # Package into 64-byte aligned USDZ archive (Apple RealityKit requirement)
        import shutil
        packaged = False
        if shutil.which('usdzip'):
            try:
                subprocess.run(['usdzip', '-a', usda_path, usdz_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                packaged = True
            except Exception as zip_err:
                print(f"[WARN] usdzip failed, using python 64-byte aligned fallback: {zip_err}")

        if not packaged:
            with zipfile.ZipFile(usdz_path, 'w', zipfile.ZIP_STORED) as zf:
                entry_name = os.path.basename(usda_path)
                zinfo = zipfile.ZipInfo(entry_name)
                header_len = 30 + len(entry_name.encode('utf-8'))
                pad = (64 - (header_len % 64)) % 64
                if pad > 0:
                    zinfo.extra = b'\x00' * pad
                with open(usda_path, 'rb') as f:
                    zf.writestr(zinfo, f.read())

        # Cleanup temp USDA file
        if os.path.exists(usda_path):
            os.remove(usda_path)

        print(f"[SUCCESS] Successfully generated native USDZ via Pixar USD with {total_prims} element prims & materials: {usdz_path}")
        return True
    except Exception as e:
        print(f"[ERROR] USDZ generation via pxr failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="PA3 High-Precision IFC Converter to GLB/USDZ")
    parser.add_argument("-i", "--input", required=True, help="Input IFC file path")
    parser.add_argument("-o", "--output", required=True, help="Output GLB file path")
    parser.add_argument("-m", "--metadata", required=False, help="Output Metadata JSON file path")
    parser.add_argument("--linear-deflection", type=float, default=DEFAULT_LINEAR_DEFLECTION,
                        help=f"Dung sai chia lưới theo phương thẳng, đơn vị mét "
                             f"(mặc định {DEFAULT_LINEAR_DEFLECTION}). Giảm xuống nếu cấu kiện "
                             f"cong bị vỡ cạnh; tăng lên nếu mô hình quá nặng.")
    parser.add_argument("--angular-deflection", type=float, default=DEFAULT_ANGULAR_DEFLECTION,
                        help=f"Dung sai chia lưới theo góc, đơn vị radian "
                             f"(mặc định {DEFAULT_ANGULAR_DEFLECTION}). Đây là số cầm lái với "
                             f"cấu kiện bán kính nhỏ như cốt thép.")

    args = parser.parse_args()
    
    ifc_path = os.path.abspath(args.input)
    glb_path = os.path.abspath(args.output)
    meta_path = os.path.abspath(args.metadata) if args.metadata else glb_path.replace(".glb", "_metadata.json")
    
    if not os.path.exists(ifc_path):
        print(f"Error: Input file {ifc_path} does not exist.")
        sys.exit(1)
        
    temp_obj_path = glb_path.replace(".glb", "_temp.obj")
    
    try:
        ifc_file, rtc_center, unit_scale, mesh_names = convert_ifc_to_obj(
            ifc_path, temp_obj_path,
            linear_deflection=args.linear_deflection,
            angular_deflection=args.angular_deflection)
        
        # Convert OBJ -> GLB
        success = convert_obj_to_glb(temp_obj_path, glb_path)
        
        # Convert OBJ -> USDZ for iOS native AR rendering
        usdz_path = glb_path.replace(".glb", ".usdz")
        convert_obj_to_usdz(temp_obj_path, usdz_path)
        
        # Extract Metadata (including RTC offset and unit scale)
        metadata = extract_metadata(ifc_file, rtc_offset=rtc_center, unit_scale=unit_scale,
                                    mesh_names=mesh_names)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"[SUCCESS] Metadata saved to: {meta_path}")
        
        # Cleanup temp OBJ
        if os.path.exists(temp_obj_path):
            os.remove(temp_obj_path)
            
        if success:
            print("\n[SUCCESS] IFC Conversion Completed Successfully!")
        else:
            print("\n[FAILED] GLB Conversion Failed.")
            sys.exit(1)

    except Exception as e:
        print(f"Error during conversion process: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
