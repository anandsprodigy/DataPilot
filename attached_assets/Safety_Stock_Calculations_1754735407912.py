import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pandas as pd
from pandas import DataFrame
import os
import threading
import math
import numpy as np
from pandas.tseries.offsets import Day, MonthEnd
import scipy.stats as st

#------------------

root = tk.Tk()
root.title('Safety Stock App')
root.geometry("300x300")

#------------------

# Define Frames
base_frame = tk.LabelFrame(root,bg='dark slate grey')
base_frame.place(height=290,width=290,rely=0,relx=0.01)

file_frame = tk.LabelFrame(base_frame, text="Action Menu",bg='azure2')
file_frame.place(height=280, width=280,rely=0.01,relx=0.01)

#------------------

# Add buttons to the data load frame
label_file = ttk.Label(file_frame, text="No Folder Selected",wraplength=250)
label_file.place(rely=0.01, relx=0)

button_browse = tk.Button(file_frame, text="Browse and Select Folder", command=lambda: File_dialog())
button_browse.place(rely=0.25, relx=0)

button_initial = tk.Button(file_frame, text="Launch Calculations",activebackground='light green'
                           ,command=lambda: invoke_base_sol())
button_initial.place(rely=0.4, relx=0)
button_initial["state"]="disabled"

label_status = ttk.Label(file_frame, text="Calculcation Not Launched")
label_status.place(rely=0.55, relx=0)

label_detail_status = ttk.Label(file_frame, text="Calculcation Not Launched")
label_detail_status.place(rely=0.7, relx=0)

button_close = tk.Button(file_frame, text="Close App",background='goldenrod2',activebackground='goldenrod2', command=root.destroy)
button_close.place(rely=0.85, relx=0)

#------------------
# Function for browsing the file
def File_dialog():
    #filename = filedialog.askopenfilename(initialdir="/",
    #                                      title="Select A File",
    #                                      filetype=(("Excel Template", "*.xlsx"),("All Files", "*.*")))
    
    filepath = filedialog.askdirectory(initialdir="/", title="Select Folder to download data")
    
    label_file["text"] = filepath
    button_initial["state"]="active"

    return None
    
#------------------
def launch_data_export(df):
    fpath = label_file["text"]
    file_out = 'SAFETY_STOCK_DATA.csv'
    fnameout = os.path.join(fpath,file_out)
    df.to_csv(fnameout,index=False, float_format='%.2f')
    label_status["text"] = 'History Based Data Export Complete'
    label_detail_status["text"] = 'File Name: SAFETY_STOCK_DATA.csv'
    
#------------------    
def launch_fcst_data_export(df):
    fpath = label_file["text"]
    file_out = 'SAFETY_STOCK_FCST_BASED.csv'
    fnameout = os.path.join(fpath,file_out)
    df.to_csv(fnameout,index=False, float_format='%.2f')
    label_status["text"] = 'History Based Data Export Complete'
    label_detail_status["text"] = 'File Name: SAFETY_STOCK_FCST_BASED.csv'
    
#------------------   
def init_calc(df_history,df_item_master):
    df1 = df_history.pivot_table(values='REF_QTY',index=['ITEM_NAME','ORG_CODE'],aggfunc=sum).reset_index()
    df1 = df1.rename(columns={'REF_QTY': 'TOTAL_QTY'})
    print(df1)
    df_history['REF_DATE'] = pd.to_datetime(df_history['REF_DATE'],format="%m/%d/%Y")
    df2 = df_history.pivot_table(values='REF_DATE',index=['ITEM_NAME','ORG_CODE'],aggfunc=[np.min,np.max]).stack().reset_index()
    print(df2)
    #df2['amin'] = pd.to_datetime(df2['amin'],format="%m/%d/%Y")
    #df2['amax'] = pd.to_datetime(df2['amax'],format="%m/%d/%Y")
    df2['min'] = pd.to_datetime(df2['min'],format="%m/%d/%Y")
    print(df2['min'])
    df2['max'] = pd.to_datetime(df2['max'],format="%m/%d/%Y")
    print(df2['max'])
    #df2['MAX_MONTH_END'] = pd.to_datetime(df2['amax'], format="%m/%d/%Y") + MonthEnd(0)
    df2['MAX_MONTH_END'] = pd.to_datetime(df2['max'], format="%m/%d/%Y") + MonthEnd(0)
    print(df2['MAX_MONTH_END'])
    #df2['DURATION_DAYS'] = (df2['MAX_MONTH_END'] - df2['amin']).dt.days
    df2['DURATION_DAYS'] = (df2['MAX_MONTH_END'] - df2['min']).dt.days
    print("Duration_days ", df2['DURATION_DAYS'])
    
    df3 = df1.merge(df2[['ITEM_NAME', 'ORG_CODE','DURATION_DAYS']])
    df3['AVERAGE_DAILY_QTY'] = (df3['TOTAL_QTY']/df3['DURATION_DAYS']).apply(np.ceil)
    print(df3);
    
    df5 = pd.DataFrame()
    for i in df2.index:
        item = df2['ITEM_NAME'][i]
        org = df2['ORG_CODE'][i]
        #start_date = df2['amin'][i]
        start_date = df2['min'][i]
        end_date = df2['MAX_MONTH_END'][i]
        date_range = pd.date_range(start=start_date,end=end_date,freq='D')
        df4 = pd.DataFrame(np.random.randn(len(date_range)), index=date_range, columns=['Value'])
        df4.index.names = ['REF_DATE']
        df4 = df4.reset_index()
        df4 = df4[['REF_DATE']]
        df4['ITEM_NAME'] = item
        df4['ORG_CODE'] = org
        if df5.empty:
            df5 = df4
        else:
            df5 = pd.concat([df5,df4], axis = 0)  
            
    df_history['REF_DATE'] = pd.to_datetime(df_history['REF_DATE'],format="%m/%d/%Y")
    df5['REF_DATE'] = pd.to_datetime(df5['REF_DATE'],format="%m/%d/%Y")
    
    print(df5)
    
    df6 = df5.merge(df_history[['ITEM_NAME','ORG_CODE','REF_DATE','REF_QTY']],how='left')
    df6['REF_QTY'] = df6['REF_QTY'].fillna(0)
    
    print(df6)
    
    df7 = df6.pivot_table(values='REF_QTY',index=['ITEM_NAME','ORG_CODE'],aggfunc=np.std).reset_index()
    df7 = df7.rename(columns={'REF_QTY': 'STD_DEV'})
    
    print(df7)
    
    df8 = df3.merge(df7[['ITEM_NAME','ORG_CODE','STD_DEV']])
    df_ss = df8.merge(df_item_master[['ITEM_NAME','ORG_CODE','LEAD_TIME','SUPPLY_LEAD_TIME_VAR_DAYS','SERVICE_LEVEL']])
    df_ss['SERVICE_FACTOR'] = st.norm.ppf(df_ss['SERVICE_LEVEL']/100)
    print(df_ss)
    print(df_ss['SERVICE_FACTOR'])
    df_ss['SS_SUP'] = (df_ss['AVERAGE_DAILY_QTY'])*df_ss['SUPPLY_LEAD_TIME_VAR_DAYS']
    print(df_ss['SS_SUP'])
    df_ss['SS_DEMAND'] = df_ss['STD_DEV']*df_ss['SERVICE_FACTOR']*np.sqrt(df_ss['LEAD_TIME']+df_ss['SUPPLY_LEAD_TIME_VAR_DAYS'])
    print(df_ss['SS_DEMAND'])
    df_ss['SS_SUP'] = df_ss['SS_SUP'].apply(np.ceil)
    print(df_ss['SS_SUP'])
    df_ss['SS_DEMAND'] = df_ss['SS_DEMAND'].apply(np.ceil)
    print(df_ss['SS_DEMAND'])
    df_ss['TOTAL_SS'] = df_ss['SS_SUP']+df_ss['SS_DEMAND']
    df_ss['DAYS_OF_COVER'] = df_ss['TOTAL_SS']/(df_ss['AVERAGE_DAILY_QTY'])
    print(df_ss)
    df_extract = df_ss
    df_extract= df_extract.drop(columns=['TOTAL_QTY', 'DURATION_DAYS'])
    #df_extract = df_extract.rename(columns={'ITEM_NAME':'Item Name','ORG_CODE':'Org Code'})
    
    label_status["text"] = 'Exporting Data - History Based'
    launch_data_export(df_extract)
    
#------------------
def init_calc_fcst(df_fcst,df_item_master):
    df_fcst['REF_DATE'] = pd.to_datetime(df_fcst['REF_DATE'],format="%m/%d/%Y")
    df_fcst['MAX_MONTH_END'] = pd.to_datetime(df_fcst['REF_DATE'], format="%m/%d/%Y") + MonthEnd(0)
    df_fcst['DURATION_DAYS'] = (df_fcst['MAX_MONTH_END'] - df_fcst['REF_DATE']).dt.days
    
    flat_cols = []
    df_fcst_ss = df_fcst.groupby(by=['ITEM_NAME','ORG_CODE']).agg({'REF_QTY':['sum'],'DURATION_DAYS':['sum'],'ERROR_TYPE':['min'],'FORECAST_ERR_PERCENT':['min']}).reset_index()
    df_fcst_ss.reset_index()
    for i in df_fcst_ss.columns:
        flat_cols.append(i[0])
    df_fcst_ss.columns = flat_cols
    
    df_fcst_ss['AVG_DAILY_FCST']=(df_fcst_ss['REF_QTY']/df_fcst_ss['DURATION_DAYS']).round(0).astype(int)
    df_fcst_ss = df_fcst_ss.merge(df_item_master[['ITEM_NAME','ORG_CODE','LEAD_TIME','SUPPLY_LEAD_TIME_VAR_DAYS','SERVICE_LEVEL']])
    
    df_fcst_ss['SERVICE_FACTOR'] = st.norm.ppf(df_fcst_ss['SERVICE_LEVEL']/100)
    df_fcst_ss['SAFETY_STOCK'] = 1.25*df_fcst_ss['SERVICE_FACTOR']*(df_fcst_ss['FORECAST_ERR_PERCENT']/100)*np.sqrt(30)*df_fcst_ss['AVG_DAILY_FCST']*np.sqrt(df_fcst_ss['LEAD_TIME'])
    df_fcst_ss['SAFETY_STOCK'] = df_fcst_ss['SAFETY_STOCK'].round(0).astype(int)
    df_fcst_ss['DAYS_OF_COVER'] = (df_fcst_ss['SAFETY_STOCK']/df_fcst_ss['AVG_DAILY_FCST']).round(0).astype(int)
    
    df_fcst_extract = df_fcst_ss
    df_fcst_extract= df_fcst_extract.drop(columns=['REF_QTY','DURATION_DAYS','ERROR_TYPE','SUPPLY_LEAD_TIME_VAR_DAYS','SERVICE_FACTOR'])
    
    label_status["text"] = 'Exporting Data - Forecast Based'
    launch_fcst_data_export(df_fcst_extract)
    
#------------------   
def invoke_base_sol():
    
    T=threading.Thread(target=launch_base_sol)
    T.start()
    while T.is_alive():
        root.update()
        pass
    T.join()

#------------------   
def launch_base_sol():
    fpath = label_file["text"]
    print('File path is ', fpath)
    if fpath == "No Folder Selected":
        tk.messagebox.showerror("Error", "Select Folder for File")
        return        
    else:
        fhistory = 'HISTORY_DATA.csv'
        fmaster = 'ITEM_MASTER.csv'
        ffcst = 'FORECAST_DATA.csv'
        fhistpath = os.path.join(fpath,fhistory)
        fmasterpath = os.path.join(fpath,fmaster)
        ffcstpath = os.path.join(fpath,ffcst)
        
    df_data = pd.read_csv(fhistpath)
    df_master = pd.read_csv(fmasterpath)
    df_fcst = pd.read_csv(ffcstpath)
    
    label_status["text"] = 'Calculating - History Based SS'
    init_calc(df_data,df_master)
    
    label_status["text"] = 'Calculating - Forecast Based SS'
    init_calc_fcst(df_fcst,df_master)
    
#------------------   
root.mainloop()