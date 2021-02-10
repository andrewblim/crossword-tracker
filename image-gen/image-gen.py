import json
import xml.etree.ElementTree as ET

# Overall image width
width = 500

# Margin drawn around the image
margin = 50

# Space reserved above the puzzle for title, byline, solver
headline_height = 50

# Space reserved below the puzzle for clue
clue_height = 50

# Space reserved below the puzzle for timer and complete message
progress_height = 50

# Scaling factor for animation
speed = 10.0

# Fonts and colors
background_color = "lightgray"
grid_color = "gray"
unfillable_color = "black"
fillable_color = "white"
label_font = "sans-serif"
fill_font = "sans-serif"
clue_font = "sans-serif"
progress_font = "sans-serif"
select_color = "yellow"
highlight_color = "skyblue"

# Name of across and down sections
across_clue_section = "Across"
down_clue_section = "Down"

with open("nyt-daily-2014-01-13.json") as fp:
    record = json.load(fp)

puzzle_width = width - margin * 2
n_cols = max(map(lambda sq: sq["x"], record["initialState"])) + 1
sq_size = puzzle_width / n_cols

n_rows = max(map(lambda sq: sq["y"], record["initialState"])) + 1
puzzle_height = sq_size * n_rows
height = puzzle_height + margin * 2 + headline_height + clue_height + progress_height

x_label_offset = 0.1 * sq_size
y_label_offset = 0.25 * sq_size
x_fill_offset = sq_size * 0.5    # TODO: address rebus
y_fill_offset = sq_size * 0.8

# font sizes
label_size = sq_size * 0.2
fill_size = sq_size * 0.6
clue_size = puzzle_width * 0.05
progress_size = clue_size * 0.75

# Root node and background
svg = ET.Element("svg", {
    "version": "1.1",
    "baseProfile": "full",
    "width": str(width),
    "height": str(height),
    "xmlns": "http://www.w3.org/2000/svg",
})
bg = ET.SubElement(svg, "rect", {
    "width": str(width),
    "height": str(height),
    "fill": background_color,
})

# Headline info
title_and_date = ET.SubElement(svg, "text", {
    "x": str(margin),
    "y": str(margin),
    "style": f"font-size: 15px; font-family: sans-serif;",
})
title = ET.SubElement(title_and_date, "tspan", {
    "style": "font-weight: bold;"
})
title.text = record["title"]
separator_and_date = ET.SubElement(title_and_date, "tspan")
separator_and_date.text = " - " + record["date"]
byline = ET.SubElement(svg, "text", {
    "x": str(margin),
    "y": str(margin + 15),
    "style": f"font-size: 12px; font-family: sans-serif;",
})
byline.text = record["byline"]
solver = ET.SubElement(svg, "text", {
    "x": str(margin),
    "y": str(margin + 15 + 15),
    "style": f"font-size: 12px; font-family: sans-serif;",
})
solver.text = "Solver: " + record["solverName"]

# Draw each square, and for any labeled squares, map the label to a position
# (x, y). This will be useful later when figuring out what squares to highlight
# when a clue is highlighted.
squares_by_position = {}
positions_by_label = {}

squares_g = ET.SubElement(svg, "g", {
    "stroke": grid_color,
})
labels_g = ET.SubElement(svg, "g", {
    "style": f"font-size: {label_size}px; font-family: {label_font}",
})

for sq in record["initialState"]:
    position = (sq["x"], sq["y"])
    squares_by_position[position] = ET.SubElement(squares_g, "rect", {
        "width": str(sq_size),
        "height": str(sq_size),
        "x": str(margin + sq["x"] * sq_size),
        "y": str(margin + headline_height + sq["y"] * sq_size),
        "fill": fillable_color if sq["fill"] is not None else unfillable_color,
    })
    if "label" in sq:
        label_elem = ET.SubElement(labels_g, "text", {
            "x": str(margin + sq["x"] * sq_size + x_label_offset),
            "y": str(margin + headline_height + sq["y"] * sq_size + y_label_offset),
        })
        label_elem.text = sq["label"]
        positions_by_label[sq["label"]] = position

# Draw all clues, but have them hidden. As we hit selectedClue events, we will
# make one of these visible at a time.
clues_g = ET.SubElement(svg, "g", {
    "style": f"font-size: {clue_size}px; font-family: {clue_font}",
    "text-anchor": "middle",
    "visibility": "hidden",
})
clues = {}
for clue_section, clue_section_list in record["clueSections"].items():
    for clue in clue_section_list:
        clue_text = clue["label"] + ". " + clue["text"]
        clues[(clue_section, clue["label"])] = ET.SubElement(clues_g, "text", {
            "x": str(width / 2),
            "y": str(margin * 2 + headline_height + puzzle_height),
        })
        clues[(clue_section, clue["label"])].text = clue_text

# Draw the timer
timer_g = ET.SubElement(svg, "g")
timer = ET.SubElement(timer_g, "text", {
    "x": str(margin),
    "y": str(margin * 2 + headline_height + puzzle_height + clue_height),
    "style": f"font-size: {progress_size}px; font-family: {progress_font}; font-weight: bold",
    "visibility": "collapse",
})
# timer_hh = ET.SubElement(timer, "tspan")
# timer_hh.text = "99"
# timer_separator1 = ET.SubElement(timer, "tspan")
# timer_separator1.text = ":"
timer_mm = []
for i in range(60):
    timer_mm_new = ET.SubElement(timer, "tspan")
    timer_mm_new.text = str(i)
    timer_mm.append(timer_mm_new)
timer_separator2 = ET.SubElement(timer, "tspan")
timer_separator2.text = ":"
timer_ss = []
for i in range(60):
    timer_ss_new = ET.SubElement(timer, "tspan")
    timer_ss_new.text = f"{i:02d}"
    timer_ss.append(timer_ss_new)

# Draw the "complete" text box, which will be made visible on complete
complete = ET.SubElement(svg, "text", {
    "x": str(width - margin),
    "y": str(margin * 2 + headline_height + puzzle_height + clue_height),
    "style": f"font-size: {progress_size}px; font-family: {progress_font}; font-weight: bold",
    "text-anchor": "end",
    "visibility": "hidden",
})
complete.text = "Complete!"

def update_square_color(sq, color, time):
    try:
        if sq[-1].get("end") is None:
            sq[-1].set("end", time)
    except IndexError:
        pass
    if color is not None:
        ET.SubElement(sq, "set", { "attributeName": "fill", "to": color, "begin": time })

fill_g = ET.SubElement(svg, "g", {
    "style": f"font-size: {fill_size}px; font-family: {fill_font}",
    "text-anchor": "middle",
    "visibility": "hidden",
})

last_fill_set_by_position = {}
selected_position = None
highlighted_positions = set()
selected_clue = None

if len(record["events"]) > 0:
    # TODO: handle start/stop
    start_time = record["events"][0]["timestamp"]
    end_time = record["events"][-1]["timestamp"]
    for event in record["events"]:
        time = str((event["timestamp"] - start_time) / speed) + "ms"
        if event["type"] == "update":
            position = (event["x"], event["y"])
            if last_fill_set_by_position.get(position) is not None:
                # Hide the previous fill in this position
                last_fill_set_by_position[position].set("end", time)
            if event["fill"] != "":
                # Add new fill that starts hidden and becomes visible when it's
                # been entered
                new_fill = ET.SubElement(fill_g, "text", {
                    "x": str(margin + event["x"] * sq_size + x_fill_offset),
                    "y": str(margin + headline_height + event["y"] * sq_size + y_fill_offset),
                })
                new_fill.text = event["fill"]
                new_fill_set = ET.SubElement(new_fill, "set", {
                    "attributeName": "visibility",
                    "to": "visible",
                    "begin": time,
                })
                last_fill_set_by_position[position] = new_fill_set
            else:
                last_fill_set_by_position[position] = None

        elif event["type"] == "select":
            position = (event["x"], event["y"])
            # Change colors of old selected position (new color depends on
            # whether it is a higlighted position), then color new selection
            if selected_position is not None and selected_position in highlighted_positions:
                update_square_color(squares_by_position[selected_position], highlight_color, time)
            elif selected_position is not None:
                update_square_color(squares_by_position[selected_position], None, time)
            update_square_color(squares_by_position[position], select_color, time)
            selected_position = position

        elif event["type"] == "selectClue":
            position = positions_by_label[event["clueLabel"]]
            if selected_clue is not None:
                selected_clue[-1].set("end", time)
            new_selected_clue = clues[(event["clueSection"], event["clueLabel"])]
            ET.SubElement(new_selected_clue, "set", {
                "attributeName": "visibility",
                "to": "visible",
                "begin": time,
            })
            selected_clue = new_selected_clue
            new_highlighted_positions = []
            if event["clueSection"] == across_clue_section:
                while squares_by_position.get(position) is not None and squares_by_position[position].get("fill") != unfillable_color:
                    new_highlighted_positions.append(position)
                    position = (position[0] + 1, position[1])
            elif event["clueSection"] == down_clue_section:
                while squares_by_position.get(position) is not None and squares_by_position[position].get("fill") != unfillable_color:
                    new_highlighted_positions.append(position)
                    position = (position[0], position[1] + 1)
            # Change color of old highlighted positions and highlight new ones,
            # in all cases doing nothing on the selected position
            for position in set(highlighted_positions) - set(new_highlighted_positions):
                if position != selected_position:
                    update_square_color(squares_by_position[position], None, time)
            for position in set(new_highlighted_positions) - set(highlighted_positions):
                if position != selected_position:
                    update_square_color(squares_by_position[position], highlight_color, time)
            highlighted_positions = new_highlighted_positions

        elif event["type"] == "submit":
            if event["success"]:
                ET.SubElement(complete, "set", {
                    "attributeName": "visibility",
                    "to": "visible",
                    "begin": time,
                })

tree = ET.ElementTree(svg)
tree.write("test.svg")
