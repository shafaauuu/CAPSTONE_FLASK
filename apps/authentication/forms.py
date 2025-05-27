from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SelectField
from wtforms.validators import Email, DataRequired, Length

# login and registration forms

class LoginForm(FlaskForm):
    login_id = StringField(
        'Login ID',
        id='login_id',
        validators=[DataRequired(), Length(max=20)],
        filters=[lambda x: x.strip() if x else x],
        render_kw={"placeholder": "Enter your User ID or Admin ID"}
    )

    password = PasswordField(
        'Password',
        id='pwd_login',
        validators=[DataRequired(), Length(min=6)],
        render_kw={"placeholder": "Enter your password"}
    )


class CreateAccountForm(FlaskForm):
    npk = StringField(
        'NPK',
        id='npk_create',
        validators=[DataRequired(), Length(max=20)],
        filters=[lambda x: x.strip() if x else x],
        render_kw={"placeholder": "Enter your NPK"}
    )
    name = StringField(
        'Name',
        id='name_create',
        validators=[DataRequired(), Length(max=50)],
        filters=[lambda x: x.strip() if x else x],
        render_kw={"placeholder": "Enter your full name"}
    )
    email = StringField(
        'Email',
        id='email_create',
        validators=[DataRequired(), Email()],
        filters=[lambda x: x.strip() if x else x],
        render_kw={"placeholder": "Enter your email"}
    )
    password = PasswordField(
        'Password',
        id='pwd_create',
        validators=[DataRequired(), Length(min=6)],
        render_kw={"placeholder": "Create a password"}
    )
    plant = SelectField(
        'Plant',
        choices=[('plant1', 'Plant 1'), ('plant2', 'Plant 2')],
        validators=[DataRequired()]
    )
    department = SelectField(
        'Department',
        choices=[('qa', 'QA'), ('production', 'Production')],
        validators=[DataRequired()]
    )
    division = SelectField(
        'Division',
        choices=[('division1', 'Division 1'), ('division2', 'Division 2')],
        validators=[DataRequired()]
    )
    role = SelectField(
        'Role',
        choices=[('user', 'User'), ('admin', 'Admin')],
        validators=[DataRequired()]
    )
